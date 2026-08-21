import type { AlertRuleRepository, AlertRuleRecord } from '../domain/alert-rule.repository.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type {
  CreateAlertRuleCommand,
  UpdateAlertRuleCommand,
  AlertRuleView,
  AlertHistoryView,
} from './dto.js';

/** Fixed vocabulary (analytics.prisma's own doc comment on AlertRule.metricCode —
 *  a String, not a DB enum, so tuning it never needs a migration; enforced here
 *  in application code instead). */
export const ALERT_METRIC_CODES = ['REVENUE_DROP', 'LOW_STOCK', 'OUT_OF_STOCK', 'PAYMENT_FAILURE_RATE', 'RETURN_RATE', 'ORDER_STUCK'] as const;
export const ALERT_COMPARATORS = ['gt', 'lt', 'gte', 'lte'] as const;

function toView(r: AlertRuleRecord): AlertRuleView {
  return { ...r, updatedAt: r.updatedAt.toISOString() };
}

function assertKnownMetric(metricCode: string): void {
  if (!ALERT_METRIC_CODES.includes(metricCode as (typeof ALERT_METRIC_CODES)[number])) {
    throw new ValidationError(`Unknown metricCode "${metricCode}" — must be one of ${ALERT_METRIC_CODES.join(', ')}`);
  }
}

export class CreateAlertRule {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(cmd: CreateAlertRuleCommand): Promise<AlertRuleView> {
    assertKnownMetric(cmd.metricCode);
    return toView(await this.rules.create(cmd));
  }
}

export class UpdateAlertRule {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(cmd: UpdateAlertRuleCommand): Promise<AlertRuleView> {
    if (!(await this.rules.findByPublicId(cmd.publicId))) throw new NotFoundError('alertRule', cmd.publicId);
    return toView(await this.rules.update(cmd.publicId, cmd));
  }
}

export class ListAlertRules {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(): Promise<AlertRuleView[]> {
    return (await this.rules.list()).map(toView);
  }
}

export class GetAlertRuleByPublicId {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(publicId: string): Promise<AlertRuleView> {
    const rule = await this.rules.findByPublicId(publicId);
    if (!rule) throw new NotFoundError('alertRule', publicId);
    return toView(rule);
  }
}

export class DeleteAlertRule {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(publicId: string): Promise<void> {
    if (!(await this.rules.findByPublicId(publicId))) throw new NotFoundError('alertRule', publicId);
    await this.rules.softDelete(publicId);
  }
}

export class ListAlertHistory {
  constructor(private readonly rules: AlertRuleRepository) {}

  async execute(publicId: string, limit = 50): Promise<AlertHistoryView[]> {
    if (!(await this.rules.findByPublicId(publicId))) throw new NotFoundError('alertRule', publicId);
    const rows = await this.rules.listHistory(publicId, limit);
    return rows.map((r) => ({
      firedAt: r.firedAt.toISOString(),
      metricValue: r.metricValue,
      thresholdValue: r.thresholdValue,
      message: r.message,
      notifiedAt: r.notifiedAt ? r.notifiedAt.toISOString() : null,
    }));
  }
}
