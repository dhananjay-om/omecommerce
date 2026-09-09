import type { AutomationRuleRepository, AutomationRuleRunRepository, AutomationTriggerType, ActionResult } from '../domain/repositories.js';
import type { OrderRepository } from '../../order/domain/repositories.js';
import type { ResolvedEntity } from './resolved-entity.js';
import { evaluateConditions } from './evaluate-condition.js';
import { runAction, type RunActionDeps } from './run-action.js';
import { logger } from '../../../shared/infrastructure/logger.js';

/** Every real outbox eventType this feature listens for, mapped to its
 *  trigger type — an event not in this map is silently ignored, same
 *  "each handler independently no-ops for job names it doesn't care
 *  about" contract as every other DOMAIN_EVENTS_QUEUE handler. */
const EVENT_TO_TRIGGER: Record<string, AutomationTriggerType> = {
  OrderPlaced: 'ORDER_PLACED',
  OrderPaid: 'ORDER_PAID',
  OrderCancelled: 'ORDER_CANCELLED',
  OrderRefunded: 'ORDER_REFUNDED',
  Shipped: 'ORDER_SHIPPED',
  OrderClosed: 'ORDER_CLOSED',
  StockChanged: 'STOCK_CHANGED',
  CustomerRegistered: 'CUSTOMER_REGISTERED',
};

/** The Rules/Workflows dispatcher — registered as one more handler inside
 *  startDomainEventsWorker()'s existing dispatch list (workers/index.ts),
 *  reusing the same queue/Worker every other domain-event consumer
 *  already shares, not a new one. */
export class EvaluateAutomationRules {
  constructor(
    private readonly rules: AutomationRuleRepository,
    private readonly runs: AutomationRuleRunRepository,
    private readonly orders: OrderRepository,
    private readonly actionDeps: RunActionDeps,
  ) {}

  async execute(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void> {
    const triggerType = EVENT_TO_TRIGGER[eventType];
    if (!triggerType) return;

    const activeRules = await this.rules.listActiveByTrigger(triggerType);
    if (activeRules.length === 0) return; // nothing to evaluate — skip resolving the entity at all

    const entity = await this.resolveEntity(triggerType, aggregateId, payload);
    if (!entity) return; // entity gone by the time this ran (a real, rare race) — nothing to evaluate against

    for (const rule of activeRules) {
      const matched = evaluateConditions(rule.conditions, entity.fields);
      const actionResults: ActionResult[] = [];
      if (matched) {
        for (const action of rule.actions) {
          const result = await runAction(action, entity, this.actionDeps);
          actionResults.push(result);
          if (!result.ok) {
            logger.warn({ ruleId: rule.id.toString(), ruleName: rule.name, action: action.type, error: result.error }, 'automation rule action failed');
          }
        }
      }
      await this.runs.record({ ruleId: rule.id, matched, entityType: entity.type, entityPublicId: entity.publicId, actionResults });
    }
  }

  private async resolveEntity(triggerType: AutomationTriggerType, aggregateId: string, payload: Record<string, unknown>): Promise<ResolvedEntity | null> {
    // StockItem/Customer: the outbox event's own payload already carries
    // every real field this pass exposes conditions/actions over — no
    // second lookup needed (see StockChanged/CustomerRegistered's own
    // outbox.write() calls: {warehouseCode, delta, reason, onHand} and
    // {email} respectively).
    if (triggerType === 'STOCK_CHANGED') {
      return {
        type: 'StockItem',
        publicId: aggregateId,
        fields: {
          onHand: toNumberOrNull(payload.onHand),
          delta: toNumberOrNull(payload.delta),
          warehouseCode: typeof payload.warehouseCode === 'string' ? payload.warehouseCode : null,
        },
        defaultRecipientEmail: null,
        label: `Stock item ${aggregateId}`,
      };
    }
    if (triggerType === 'CUSTOMER_REGISTERED') {
      const email = typeof payload.email === 'string' ? payload.email : null;
      return {
        type: 'Customer',
        publicId: aggregateId,
        fields: { email },
        defaultRecipientEmail: email,
        label: email ?? `Customer ${aggregateId}`,
      };
    }
    // Every remaining trigger is order-scoped — re-fetch the order fresh
    // rather than trusting the event payload's own (varying, minimal)
    // shape, so conditions always see the order's real, current fields
    // at the moment this rule actually evaluates.
    const order = await this.orders.findByPublicId(aggregateId);
    if (!order) return null;
    return {
      type: 'Order',
      publicId: order.publicId,
      fields: {
        status: order.status,
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        grandTotal: Number(order.grandTotal),
        currency: order.currency,
      },
      defaultRecipientEmail: order.email,
      label: `Order #${order.orderNumber}`,
    };
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}
