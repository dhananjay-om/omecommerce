import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AiInsightRepository } from '../domain/repositories.js';
import type { AnalyticsQueryRepository, DateRange } from '../../analytics/domain/queries.js';
import { dateKeyOf } from '../../analytics/domain/date-key.js';

interface InsightDraft {
  ruleCode: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  headline: string;
  actionLabel: string;
  actionHref: string;
}

function shiftDays(dateKey: number, days: number): Date {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Percent change from `previous` to `current`, or null when `previous` is
 *  0/undefined (a "from zero" percentage is meaningless — same convention
 *  as the Dashboard's own percentDelta helper, apps/admin/src/app/
 *  (dashboard)/dashboard/page.tsx). */
function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * The AI Insights rule engine — every rule is a small, explainable threshold
 * check over real numbers already exposed by AnalyticsQueryRepository (no
 * new raw aggregation SQL; the existing analytics module already computes
 * everything these rules need). Deliberately not LLM-based — same
 * "explainable, data-grounded" philosophy the Dashboard's own
 * ai-insights.tsx already established (see that component's own header
 * comment) — this is that pattern's larger, persisted, exhaustive version,
 * not a different kind of "AI".
 *
 * Each rule compares a trailing 7-day window ending at `dateKey` against the
 * 7 days immediately before it — a nightly cadence with enough smoothing to
 * avoid single-day noise, without needing a whole extra "how far back"
 * config surface for a first pass.
 *
 * Revenue/payment/return rules sum across every currency row a website
 * returns for the window, rather than firing one insight per currency — a
 * deliberate simplification (this project's real data is single-currency
 * per website in practice; a mixed-currency website would get a slightly
 * blended percentage here, acceptable for a qualitative "notable change"
 * signal, unlike analytics.prisma's own summary tables which must never
 * blend currencies for a precise financial total).
 */
export class PrismaAiInsightRepository implements AiInsightRepository {
  constructor(
    private readonly db: Db,
    private readonly analytics: AnalyticsQueryRepository,
  ) {}

  async listWebsiteIds(): Promise<bigint[]> {
    const websites = await this.db.website.findMany({ select: { id: true } });
    return websites.map((w) => w.id);
  }

  async refreshInsights(dateKey: number, websiteId: bigint): Promise<void> {
    const currentRange: DateRange = { fromDateKey: dateKeyOf(shiftDays(dateKey, -6)), toDateKey: dateKey, websiteId };
    const previousRange: DateRange = { fromDateKey: dateKeyOf(shiftDays(dateKey, -13)), toDateKey: dateKeyOf(shiftDays(dateKey, -7)), websiteId };

    const drafts = (
      await Promise.all([
        this.revenueRule(currentRange, previousRange),
        this.stockRules(),
        this.paymentFailureRule(currentRange),
        this.returnRateRule(currentRange),
        this.orderStuckRule(websiteId),
        this.fulfillmentSlowdownRule(currentRange, previousRange),
        this.newCustomersRule(currentRange),
      ])
    ).flat();

    const firedRuleCodes = drafts.map((d) => d.ruleCode);
    // A rule that fired on a previous refresh but no longer holds must not
    // leave a stale row behind — delete anything for this bucket that isn't
    // in this run's fired set first, same "don't just upsert, also clear
    // what's no longer true" reasoning as this session's summary_sales_daily
    // fix, generalized: there's no "zero" state for an insight, it either
    // exists or it doesn't.
    await this.db.aiInsight.deleteMany({
      where: { dateKey, websiteId, ruleCode: firedRuleCodes.length > 0 ? { notIn: firedRuleCodes } : undefined },
    });
    for (const draft of drafts) {
      await this.db.aiInsight.upsert({
        where: { dateKey_websiteId_ruleCode: { dateKey, websiteId, ruleCode: draft.ruleCode } },
        create: { dateKey, websiteId, ...draft },
        update: { category: draft.category, impact: draft.impact, headline: draft.headline, actionLabel: draft.actionLabel, actionHref: draft.actionHref },
      });
    }
  }

  private async revenueRule(currentRange: DateRange, previousRange: DateRange): Promise<InsightDraft[]> {
    const [current, previous] = await Promise.all([this.analytics.getSalesTrend(currentRange), this.analytics.getSalesTrend(previousRange)]);
    const currentRevenue = current.reduce((sum, r) => sum + Number(r.netRevenue), 0);
    const previousRevenue = previous.reduce((sum, r) => sum + Number(r.netRevenue), 0);
    const delta = percentDelta(currentRevenue, previousRevenue);
    if (delta === null || Math.abs(delta) < 10) return [];

    const ruleCode = delta >= 0 ? 'REVENUE_UP' : 'REVENUE_DROP';
    return [
      {
        ruleCode,
        category: 'Sales',
        impact: Math.abs(delta) >= 25 ? 'high' : 'medium',
        headline: `Revenue ${delta >= 0 ? 'increased' : 'decreased'} ${Math.abs(delta).toFixed(1)}% over the last 7 days vs. the previous 7.`,
        actionLabel: 'View Sales Analytics',
        actionHref: '/reports/sales',
      },
    ];
  }

  private async stockRules(): Promise<InsightDraft[]> {
    const outOfStockCount = await this.analytics.countOutOfStock();
    if (outOfStockCount > 0) {
      return [
        {
          ruleCode: 'OUT_OF_STOCK',
          category: 'Inventory',
          impact: 'high',
          headline: `${outOfStockCount} SKU${outOfStockCount === 1 ? ' is' : 's are'} out of stock right now.`,
          actionLabel: 'View Inventory',
          actionHref: '/inventory',
        },
      ];
    }
    const lowStockCount = await this.analytics.countLowStock();
    if (lowStockCount > 0) {
      return [
        {
          ruleCode: 'LOW_STOCK',
          category: 'Inventory',
          impact: 'medium',
          headline: `${lowStockCount} SKU${lowStockCount === 1 ? ' is' : 's are'} running low on stock.`,
          actionLabel: 'View Inventory',
          actionHref: '/inventory',
        },
      ];
    }
    return [];
  }

  private async paymentFailureRule(currentRange: DateRange): Promise<InsightDraft[]> {
    const rows = await this.analytics.getPaymentMethodBreakdown(currentRange);
    const success = rows.reduce((sum, r) => sum + r.successCount, 0);
    const failed = rows.reduce((sum, r) => sum + r.failedCount, 0);
    if (success + failed === 0) return [];
    const failureRate = failed / (success + failed);
    if (failureRate < 0.05) return [];
    return [
      {
        ruleCode: 'PAYMENT_FAILURE_SPIKE',
        category: 'Orders',
        impact: failureRate >= 0.15 ? 'high' : 'medium',
        headline: `Payment failure rate is ${(failureRate * 100).toFixed(1)}% over the last 7 days.`,
        actionLabel: 'View Orders',
        actionHref: '/orders',
      },
    ];
  }

  private async returnRateRule(currentRange: DateRange): Promise<InsightDraft[]> {
    const [returns, sales] = await Promise.all([this.analytics.getReturnsTrend(currentRange), this.analytics.getSalesTrend(currentRange)]);
    const returnAmount = returns.reduce((sum, r) => sum + Number(r.returnAmount), 0);
    const grossRevenue = sales.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
    if (grossRevenue === 0) return [];
    const returnRate = returnAmount / grossRevenue;
    if (returnRate < 0.02) return [];
    return [
      {
        ruleCode: 'RETURN_RATE_UP',
        category: 'Orders',
        impact: returnRate >= 0.05 ? 'high' : 'medium',
        headline: `Return rate is ${(returnRate * 100).toFixed(1)}% over the last 7 days.`,
        actionLabel: 'View Orders',
        actionHref: '/orders?financialStatus=REFUNDED',
      },
    ];
  }

  private async orderStuckRule(websiteId: bigint): Promise<InsightDraft[]> {
    const daysThreshold = 3;
    const count = await this.analytics.countStuckOrders(daysThreshold, websiteId);
    if (count === 0) return [];
    return [
      {
        ruleCode: 'ORDER_STUCK',
        category: 'Orders',
        impact: count >= 5 ? 'high' : 'medium',
        headline: `${count} order${count === 1 ? ' has' : 's have'} been stuck in processing for ${daysThreshold}+ days.`,
        actionLabel: 'View Orders',
        actionHref: '/orders?status=PROCESSING',
      },
    ];
  }

  private async fulfillmentSlowdownRule(currentRange: DateRange, previousRange: DateRange): Promise<InsightDraft[]> {
    const avg = (rows: Array<{ avgProcessingHours: string | null }>): number | null => {
      const values = rows.map((r) => (r.avgProcessingHours !== null ? Number(r.avgProcessingHours) : null)).filter((v): v is number => v !== null);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const [current, previous] = await Promise.all([this.analytics.getFulfillmentTrend(currentRange), this.analytics.getFulfillmentTrend(previousRange)]);
    const currentAvg = avg(current);
    const previousAvg = avg(previous);
    if (currentAvg === null || previousAvg === null) return [];
    const delta = percentDelta(currentAvg, previousAvg);
    if (delta === null || delta < 25) return [];
    return [
      {
        ruleCode: 'FULFILLMENT_SLOWDOWN',
        category: 'Fulfillment',
        impact: delta >= 50 ? 'high' : 'medium',
        headline: `Average order processing time rose to ${currentAvg.toFixed(1)}h (was ${previousAvg.toFixed(1)}h) over the last 7 days.`,
        actionLabel: 'View Orders',
        actionHref: '/orders',
      },
    ];
  }

  private async newCustomersRule(currentRange: DateRange): Promise<InsightDraft[]> {
    const rows = await this.analytics.getCustomerActivityTrend(currentRange);
    const newCustomers = rows.reduce((sum, r) => sum + r.newCustomers, 0);
    if (newCustomers === 0) return [];
    return [
      {
        ruleCode: 'NEW_CUSTOMERS',
        category: 'Customers',
        impact: 'low',
        headline: `${newCustomers} new customer${newCustomers === 1 ? '' : 's'} in the last 7 days.`,
        actionLabel: 'View Customers',
        actionHref: '/customers',
      },
    ];
  }
}
