import type { AnalyticsQueryRepository, DateRange } from '../domain/queries.js';
import { parseDateKey } from '../domain/date-key.js';
import type { AnalyticsDateRangeQuery } from './dto.js';

/** Exported for reuse by RunAdHocReport (report-builder.usecase.ts) —
 *  the Report Builder dispatches to these same methods and needs the
 *  identical dateFrom/dateTo → DateRange conversion, not a second copy. */
export function toRange(q: AnalyticsDateRangeQuery): DateRange {
  return {
    fromDateKey: parseDateKey(q.dateFrom),
    toDateKey: parseDateKey(q.dateTo),
    websiteId: q.websiteId !== undefined ? BigInt(q.websiteId) : undefined,
  };
}

/** One thin usecase per dashboard query — each just range-parses and
 *  delegates, matching this module's read/write port split
 *  (domain/queries.ts's header comment): there's no business logic left to
 *  own here, the aggregation logic already lives in the projector/refresh
 *  write path (plan/19 §2's "compute once, read many times" design). */
export class GetSalesTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getSalesTrend(toRange(q));
  }
}

export class GetOrderStatusBreakdown {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getOrderStatusBreakdown(toRange(q));
  }
}

export class GetTopProducts {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery, limit: number) {
    return this.analytics.getTopProducts(toRange(q), limit);
  }
}

export class GetTopCategories {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery, limit: number) {
    return this.analytics.getTopCategories(toRange(q), limit);
  }
}

export class GetPaymentMethodBreakdown {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getPaymentMethodBreakdown(toRange(q));
  }
}

export class GetReturnsTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getReturnsTrend(toRange(q));
  }
}

export class GetFulfillmentTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getFulfillmentTrend(toRange(q));
  }
}

export class GetLowStockNow {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(limit: number) {
    return this.analytics.getLowStockNow(limit);
  }
}

export class GetRfmSegments {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute() {
    return this.analytics.getRfmSegments();
  }
}

export class GetReconciliationLog {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getReconciliationLog(toRange(q));
  }
}

export class GetCustomerActivityTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getCustomerActivityTrend(toRange(q));
  }
}

export class GetTopCustomers {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery, limit: number) {
    return this.analytics.getTopCustomers(toRange(q), limit);
  }
}

export class GetInventoryTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getInventoryTrend(toRange(q));
  }
}

// --- Marketing Analytics ---

export class GetCouponPerformance {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery, limit: number) {
    return this.analytics.getCouponPerformance(toRange(q), limit);
  }
}

export class GetCouponRedemptionTrend {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getCouponRedemptionTrend(toRange(q));
  }
}

export class GetReferralFunnel {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getReferralFunnel(toRange(q));
  }
}

export class GetTopReferrers {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery, limit: number) {
    return this.analytics.getTopReferrers(toRange(q), limit);
  }
}

// --- Financial Analytics ---

export class GetTaxBreakdown {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute(q: AnalyticsDateRangeQuery) {
    return this.analytics.getTaxBreakdown(toRange(q));
  }
}

export class GetStoredValueLiability {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute() {
    return this.analytics.getStoredValueLiability();
  }
}

export class GetCreditAccountSummary {
  constructor(private readonly analytics: AnalyticsQueryRepository) {}
  execute() {
    return this.analytics.getCreditAccountSummary();
  }
}
