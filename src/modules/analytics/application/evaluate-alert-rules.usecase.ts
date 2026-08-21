import type { AlertRuleRepository } from '../domain/alert-rule.repository.js';
import type { AnalyticsQueryRepository } from '../domain/queries.js';
import { dateKeyOf, yesterdayDateKey } from '../domain/date-key.js';
import { logger } from '../../../shared/infrastructure/logger.js';

function compare(value: number, comparator: string, threshold: number): boolean {
  switch (comparator) {
    case 'gt':
      return value > threshold;
    case 'lt':
      return value < threshold;
    case 'gte':
      return value >= threshold;
    case 'lte':
      return value <= threshold;
    default:
      return false; // unknown comparator never fires (fail closed, not open)
  }
}

/** Evaluates every active AlertRule against its metric's current value over
 *  its own trailing `windowDays`, run as the last step of the nightly
 *  refresh worker (plan/19 §10/§11) — after summary tables for the closed
 *  day are up to date, not before. Fires (writes an AlertHistory row) when
 *  the comparator condition holds. `notifiedAt` is deliberately left unset —
 *  actual email delivery is an explicit open question (plan/19 §16), not a
 *  silently-skipped step; the fired condition itself is always recorded. */
export class EvaluateAlertRules {
  constructor(
    private readonly rules: AlertRuleRepository,
    private readonly analytics: AnalyticsQueryRepository,
  ) {}

  async execute(now: Date): Promise<void> {
    const toDateKey = yesterdayDateKey(now); // the most recent fully-closed day
    const active = await this.rules.listActiveForEvaluation();

    for (const rule of active) {
      try {
        const fromDateKey = dateKeyOf(shiftDays(toDateKey, -(rule.windowDays - 1)));
        const range = { fromDateKey, toDateKey };
        const threshold = Number(rule.thresholdValue);
        let metricValue: number;

        switch (rule.metricCode) {
          case 'REVENUE_DROP': {
            const rows = await this.analytics.getSalesTrend(range);
            metricValue = rows.reduce((sum, r) => sum + Number(r.netRevenue), 0);
            break;
          }
          case 'LOW_STOCK':
            metricValue = await this.analytics.countLowStock();
            break;
          case 'OUT_OF_STOCK':
            metricValue = await this.analytics.countOutOfStock();
            break;
          case 'PAYMENT_FAILURE_RATE': {
            const rows = await this.analytics.getPaymentMethodBreakdown(range);
            const success = rows.reduce((sum, r) => sum + r.successCount, 0);
            const failed = rows.reduce((sum, r) => sum + r.failedCount, 0);
            metricValue = success + failed > 0 ? failed / (success + failed) : 0;
            break;
          }
          case 'RETURN_RATE': {
            const [returns, sales] = await Promise.all([this.analytics.getReturnsTrend(range), this.analytics.getSalesTrend(range)]);
            const returnAmount = returns.reduce((sum, r) => sum + Number(r.returnAmount), 0);
            const grossRevenue = sales.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
            metricValue = grossRevenue > 0 ? returnAmount / grossRevenue : 0;
            break;
          }
          case 'ORDER_STUCK':
            metricValue = await this.analytics.countStuckOrders(rule.windowDays);
            break;
          default:
            continue; // unknown metricCode — schema allows it to exist (String, not enum), evaluator just skips
        }

        if (compare(metricValue, rule.comparator, threshold)) {
          const message = `${rule.metricCode} ${rule.comparator} ${rule.thresholdValue} — actual ${metricValue}`;
          await this.rules.recordFired(rule.id, metricValue.toString(), rule.thresholdValue, message);
        }
      } catch (err) {
        // One rule's evaluation failing (e.g. a transient DB error) must
        // never block the rest of the batch — same isolation posture as
        // startDomainEventsWorker()'s per-handler try/catch.
        logger.error({ err, ruleId: rule.publicId, metricCode: rule.metricCode }, 'alert rule evaluation failed');
      }
    }
  }
}

function shiftDays(dateKey: number, days: number): Date {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
