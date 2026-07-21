import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import type { OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

const CLOSED_FINANCIAL_STATUSES = new Set(['PAID', 'REFUNDED']);

/**
 * plan/15 Phase 4 — CLOSED is a terminal merchant-initiated state distinct
 * from COMPLETED (see _base.prisma's OrderStatus doc comment): "fully
 * delivered, no pending shipment/refund". This codebase has no carrier
 * delivery-confirmation webhook/usecase (no route marks a Fulfillment
 * DELIVERED — out of scope, same as the rest of plan/15's carrier-
 * integration cuts), so "fully delivered" is guarded against the closest
 * reachable concept: every order line fully shipped (fulfillmentStatus ===
 * FULFILLED). A literal per-Fulfillment DELIVERED check would make this
 * guard permanently unreachable via the actual API surface — verified by
 * testing it, not assumed.
 */
export class CloseOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(orderPublicId: string): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(orderPublicId);
    if (!order) throw new NotFoundError('Order', orderPublicId);

    if (order.status === 'CLOSED') throw new InvalidOrderStateError(`order ${orderPublicId} is already closed`);
    if (order.status === 'CANCELLED') throw new InvalidOrderStateError(`order ${orderPublicId} is cancelled — cannot close`);
    if (order.fulfillmentStatus !== 'FULFILLED') {
      throw new InvalidOrderStateError(`order ${orderPublicId} is not fully shipped — cannot close`);
    }
    if (!CLOSED_FINANCIAL_STATUSES.has(order.financialStatus)) {
      throw new InvalidOrderStateError(`order ${orderPublicId} has a pending financial state (${order.financialStatus}) — cannot close`);
    }

    const closedAt = new Date();
    await this.orders.setClosedAt(order.id, closedAt);
    await this.outbox.write({
      aggregateType: 'Order',
      aggregateId: order.publicId,
      eventType: 'OrderClosed',
      payload: { orderNumber: order.orderNumber },
    });
    await this.orders.recordHistory({
      orderId: order.id,
      eventType: 'CLOSED',
      fromValue: order.status,
      toValue: 'CLOSED',
      message: 'Order closed',
      actorType: 'ADMIN',
    });

    const final = await this.orders.findByPublicId(orderPublicId);
    return toOrderDto(final!);
  }
}
