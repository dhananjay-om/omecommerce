import type { AnalyticsQueryRepository, DateRange } from '../domain/queries.js';
import { findReportMetric, type ReportColumnDef } from '../domain/report-metrics.js';
import type { AnalyticsDateRangeQuery } from './dto.js';
import { toRange } from './query-analytics.usecases.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export interface ReportResult {
  metricCode: string;
  metricLabel: string;
  columns: ReportColumnDef[];
  rows: Array<Record<string, unknown>>;
}

/** Dispatches one metric code to the real repository method that already
 *  computes it — no duplicate query logic, "one engine" same as every
 *  prior feature in this app. Each branch's return type is a real,
 *  already-typed row array; cast to the generic tabular shape only at
 *  the boundary (`rows: Record<string, unknown>[]`), matching
 *  REPORT_METRICS' own column keys exactly (verified 1:1 against
 *  domain/queries.ts's row interfaces when each metric was added). */
export class RunAdHocReport {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}

  async execute(metricCode: string, q: AnalyticsDateRangeQuery, limit: number): Promise<ReportResult> {
    const def = findReportMetric(metricCode);
    if (!def) throw new ValidationError(`Unknown report metric: ${metricCode}`);
    const range = toRange(q);
    const rows = await this.fetchRows(metricCode, range, limit);
    return { metricCode: def.code, metricLabel: def.label, columns: def.columns, rows: rows as unknown as Array<Record<string, unknown>> };
  }

  private fetchRows(metricCode: string, range: DateRange, limit: number): Promise<unknown[]> {
    switch (metricCode) {
      case 'SALES_TREND':
        return this.analytics.getSalesTrend(range);
      case 'ORDER_STATUS':
        return this.analytics.getOrderStatusBreakdown(range);
      case 'TOP_PRODUCTS':
        return this.analytics.getTopProducts(range, limit);
      case 'TOP_CATEGORIES':
        return this.analytics.getTopCategories(range, limit);
      case 'PAYMENT_METHODS':
        return this.analytics.getPaymentMethodBreakdown(range);
      case 'RETURNS_TREND':
        return this.analytics.getReturnsTrend(range);
      case 'FULFILLMENT_TREND':
        return this.analytics.getFulfillmentTrend(range);
      case 'CUSTOMER_ACTIVITY':
        return this.analytics.getCustomerActivityTrend(range);
      case 'TOP_CUSTOMERS':
        return this.analytics.getTopCustomers(range, limit);
      case 'INVENTORY_TREND':
        return this.analytics.getInventoryTrend(range);
      case 'COUPON_PERFORMANCE':
        return this.analytics.getCouponPerformance(range, limit);
      case 'COUPON_REDEMPTION_TREND':
        return this.analytics.getCouponRedemptionTrend(range);
      case 'TOP_REFERRERS':
        return this.analytics.getTopReferrers(range, limit);
      case 'TAX_BREAKDOWN':
        return this.analytics.getTaxBreakdown(range);
      default:
        // Unreachable given findReportMetric() already validated metricCode
        // against the same registry this switch is derived from.
        throw new ValidationError(`Unknown report metric: ${metricCode}`);
    }
  }
}

/** Plain CSV serialization — bigint/Decimal-string/number/null all just
 *  stringify; a cell containing a comma or quote gets quoted per RFC
 *  4180 (the same escaping every spreadsheet app expects). */
export function reportToCsv(result: ReportResult): string {
  const header = result.columns.map((c) => csvCell(c.label)).join(',');
  const lines = result.rows.map((row) => result.columns.map((c) => csvCell(row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
