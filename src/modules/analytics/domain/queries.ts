/**
 * The analytics read port — separate from `AnalyticsRepository` (the write/
 * refresh port in repositories.ts) on purpose: reads are plain queries over
 * already-materialized summary_ / fact_ / customer_rfm rows (cheap, no
 * business logic), while writes are the expensive idempotent
 * re-aggregations. Keeping them as two interfaces means a future
 * read-replica routing decision (send AnalyticsQueryRepository reads to a
 * replica, keep AnalyticsRepository writes on the primary) needs no
 * redesign — just a different Db passed to the Prisma implementation.
 */

export interface DateRange {
  fromDateKey: number;
  toDateKey: number;
  websiteId?: bigint;
}

export interface SalesDailyRow {
  dateKey: number;
  websiteId: bigint;
  currency: string;
  grossRevenue: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  refundTotal: string;
  netRevenue: string;
  orderCount: number;
  unitsSold: number;
  newCustomerCount: number;
}

export interface OrderStatusRow {
  dateKey: number;
  status: string;
  orderCount: number;
}

export interface ProductPerformanceRow {
  productId: bigint;
  productName: string | null;
  sku: string | null;
  unitsSold: number;
  revenue: string;
  orderCount: number;
}

export interface CategoryPerformanceRow {
  categoryId: bigint;
  categoryName: string | null;
  unitsSold: number;
  revenue: string;
}

export interface PaymentMethodRow {
  method: string;
  gateway: string;
  successCount: number;
  failedCount: number;
  successAmount: string;
  refundedAmount: string;
}

export interface ReturnDailyRow {
  dateKey: number;
  returnCount: number;
  returnQty: number;
  returnAmount: string;
}

export interface FulfillmentDailyRow {
  dateKey: number;
  ordersProcessed: number;
  avgProcessingHours: string | null;
  avgShippingHours: string | null;
  avgDeliveryHours: string | null;
}

export interface InventorySnapshotRow {
  variantId: bigint;
  sku: string | null;
  productName: string | null;
  warehouseId: bigint;
  warehouseName: string | null;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number | null;
}

export interface RfmSegmentCount {
  segment: string;
  customerCount: number;
}

export interface ReconciliationRow {
  dateKey: number;
  tableName: string;
  expectedCount: number;
  actualCount: number;
  diffCount: number;
  diffAmount: string | null;
}

export interface AnalyticsQueryRepository {
  getSalesTrend(range: DateRange): Promise<SalesDailyRow[]>;
  getOrderStatusBreakdown(range: DateRange): Promise<OrderStatusRow[]>;
  /** Aggregated across the whole range (not one row per day) — "best
   *  sellers in this period", capped at `limit`, sorted by revenue desc. */
  getTopProducts(range: DateRange, limit: number): Promise<ProductPerformanceRow[]>;
  getTopCategories(range: DateRange, limit: number): Promise<CategoryPerformanceRow[]>;
  getPaymentMethodBreakdown(range: DateRange): Promise<PaymentMethodRow[]>;
  getReturnsTrend(range: DateRange): Promise<ReturnDailyRow[]>;
  getFulfillmentTrend(range: DateRange): Promise<FulfillmentDailyRow[]>;
  /** Live, not from the nightly snapshot — the Inventory dashboard's
   *  "low stock right now" widget (see SummaryInventoryDaily's own doc
   *  comment: this is the one place that table's schema deliberately says
   *  to bypass it). Returns rows where available <= reorderPoint. */
  getLowStockNow(limit: number): Promise<InventorySnapshotRow[]>;
  /** Live counts backing the LOW_STOCK / OUT_OF_STOCK alerts — same
   *  live-query exception as getLowStockNow/countStuckOrders. */
  countLowStock(): Promise<number>;
  countOutOfStock(): Promise<number>;
  getRfmSegments(): Promise<RfmSegmentCount[]>;
  getReconciliationLog(range: DateRange): Promise<ReconciliationRow[]>;

  /** Live query, not summary-table-derived (the ORDER_STUCK alert's
   *  documented exception — see analytics.prisma's header comment): orders
   *  that reached PROCESSING/CONFIRMED and have sat there longer than
   *  `daysThreshold` without closing out. */
  countStuckOrders(daysThreshold: number, websiteId?: bigint): Promise<number>;
}
