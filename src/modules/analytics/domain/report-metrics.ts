/**
 * Reports > Report Builder's metric registry — a curated, real list, not
 * an arbitrary metric/group-by/dimension pivot engine. Each entry maps
 * 1:1 to an existing `AnalyticsQueryRepository` method, which already has
 * its own fixed, sensible grouping (Top Products groups by product,
 * Sales Trend groups by day, ...) — reused directly here, never
 * re-implemented (same "one engine" precedent as every prior feature this
 * project has built this way).
 *
 * Scoped to date-ranged, tabular methods only. Excluded on purpose:
 * - Live "right now" snapshots (getLowStockNow, countLowStock,
 *   countOutOfStock, getRfmSegments, getReferralFunnel,
 *   getStoredValueLiability, getCreditAccountSummary, countStuckOrders) —
 *   these don't take a date range, so they don't fit this builder's
 *   uniform "pick a metric + a date range" UX; every one of them already
 *   has its own tile on a real dashboard page (Inventory, Financial,
 *   Marketing) instead.
 * - getReconciliationLog — an ops-internal consistency check, not a
 *   merchant-facing report (same "skip the ops-internal tool" precedent
 *   as the Data Migration feature's own AI Assistant tool curation).
 *
 * True arbitrary group-by/dimension pivoting (the nav's own original
 * "pick a metric, group by, and date range" phrasing) is a materially
 * bigger feature than this — trimmed and disclosed here, not silently
 * downgraded.
 */

export type ReportMetricCategory = 'Sales' | 'Orders' | 'Products' | 'Customers' | 'Inventory' | 'Marketing' | 'Financial';

export interface ReportColumnDef {
  key: string;
  label: string;
}

export interface ReportMetricDefinition {
  code: string;
  label: string;
  description: string;
  category: ReportMetricCategory;
  /** Whether this metric's usecase call takes a `limit` (a "top N" style
   *  query) — the builder UI shows a row-count input only for these. */
  hasLimit: boolean;
  columns: ReportColumnDef[];
}

export const REPORT_METRICS: ReportMetricDefinition[] = [
  {
    code: 'SALES_TREND',
    label: 'Sales Trend',
    description: 'Daily gross/net revenue, discounts, tax, shipping, and refunds.',
    category: 'Sales',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'currency', label: 'Currency' },
      { key: 'grossRevenue', label: 'Gross Revenue' },
      { key: 'discountTotal', label: 'Discounts' },
      { key: 'taxTotal', label: 'Tax' },
      { key: 'shippingTotal', label: 'Shipping' },
      { key: 'refundTotal', label: 'Refunds' },
      { key: 'netRevenue', label: 'Net Revenue' },
      { key: 'orderCount', label: 'Orders' },
      { key: 'unitsSold', label: 'Units Sold' },
    ],
  },
  {
    code: 'ORDER_STATUS',
    label: 'Orders by Status',
    description: 'Daily order counts grouped by status.',
    category: 'Orders',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'orderCount', label: 'Orders' },
    ],
  },
  {
    code: 'TOP_PRODUCTS',
    label: 'Top Products',
    description: 'Best-selling products by revenue over the date range.',
    category: 'Products',
    hasLimit: true,
    columns: [
      { key: 'productName', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'unitsSold', label: 'Units Sold' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'orderCount', label: 'Orders' },
    ],
  },
  {
    code: 'TOP_CATEGORIES',
    label: 'Top Categories',
    description: 'Best-selling categories by revenue over the date range.',
    category: 'Products',
    hasLimit: true,
    columns: [
      { key: 'categoryName', label: 'Category' },
      { key: 'unitsSold', label: 'Units Sold' },
      { key: 'revenue', label: 'Revenue' },
    ],
  },
  {
    code: 'PAYMENT_METHODS',
    label: 'Payment Method Mix',
    description: 'Success/failure counts and amounts by payment method.',
    category: 'Financial',
    hasLimit: false,
    columns: [
      { key: 'method', label: 'Method' },
      { key: 'gateway', label: 'Gateway' },
      { key: 'successCount', label: 'Succeeded' },
      { key: 'failedCount', label: 'Failed' },
      { key: 'successAmount', label: 'Succeeded Amount' },
      { key: 'refundedAmount', label: 'Refunded Amount' },
    ],
  },
  {
    code: 'RETURNS_TREND',
    label: 'Returns Trend',
    description: 'Daily return counts, quantities, and amounts.',
    category: 'Orders',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'returnCount', label: 'Returns' },
      { key: 'returnQty', label: 'Qty Returned' },
      { key: 'returnAmount', label: 'Return Amount' },
    ],
  },
  {
    code: 'FULFILLMENT_TREND',
    label: 'Fulfillment Trend',
    description: 'Daily orders processed and average processing/shipping time.',
    category: 'Orders',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'ordersProcessed', label: 'Orders Processed' },
      { key: 'avgProcessingHours', label: 'Avg Processing (hrs)' },
      { key: 'avgShippingHours', label: 'Avg Shipping (hrs)' },
    ],
  },
  {
    code: 'CUSTOMER_ACTIVITY',
    label: 'Customer Activity Trend',
    description: 'Daily new vs. returning customers and revenue.',
    category: 'Customers',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'newCustomers', label: 'New Customers' },
      { key: 'returningCustomers', label: 'Returning Customers' },
      { key: 'totalOrders', label: 'Orders' },
      { key: 'totalRevenue', label: 'Revenue' },
    ],
  },
  {
    code: 'TOP_CUSTOMERS',
    label: 'Top Customers',
    description: 'Highest-revenue customers over the date range.',
    category: 'Customers',
    hasLimit: true,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'ordersPlaced', label: 'Orders' },
      { key: 'revenue', label: 'Revenue' },
    ],
  },
  {
    code: 'INVENTORY_TREND',
    label: 'Inventory Trend',
    description: 'Daily on-hand/reserved/available stock and low-stock count.',
    category: 'Inventory',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'totalOnHand', label: 'On Hand' },
      { key: 'totalReserved', label: 'Reserved' },
      { key: 'totalAvailable', label: 'Available' },
      { key: 'lowStockCount', label: 'Low Stock Items' },
    ],
  },
  {
    code: 'COUPON_PERFORMANCE',
    label: 'Coupon Performance',
    description: 'Redemption count and discount given, per coupon.',
    category: 'Marketing',
    hasLimit: true,
    columns: [
      { key: 'code', label: 'Coupon Code' },
      { key: 'currency', label: 'Currency' },
      { key: 'redemptionCount', label: 'Redemptions' },
      { key: 'discountAmount', label: 'Discount Given' },
    ],
  },
  {
    code: 'COUPON_REDEMPTION_TREND',
    label: 'Coupon Redemption Trend',
    description: 'Daily coupon redemption count and discount given.',
    category: 'Marketing',
    hasLimit: false,
    columns: [
      { key: 'dateKey', label: 'Date' },
      { key: 'currency', label: 'Currency' },
      { key: 'redemptionCount', label: 'Redemptions' },
      { key: 'discountAmount', label: 'Discount Given' },
    ],
  },
  {
    code: 'TOP_REFERRERS',
    label: 'Top Referrers',
    description: 'Customers who referred the most people over the date range.',
    category: 'Marketing',
    hasLimit: true,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'referralCount', label: 'Referrals' },
      { key: 'qualifiedCount', label: 'Qualified' },
      { key: 'rewardedCount', label: 'Rewarded' },
    ],
  },
  {
    code: 'TAX_BREAKDOWN',
    label: 'Tax Breakdown',
    description: 'GST amount collected by tax type (CGST/SGST/IGST) and currency.',
    category: 'Financial',
    hasLimit: false,
    columns: [
      { key: 'taxType', label: 'Tax Type' },
      { key: 'currency', label: 'Currency' },
      { key: 'amount', label: 'Amount' },
    ],
  },
];

export function findReportMetric(code: string): ReportMetricDefinition | undefined {
  return REPORT_METRICS.find((m) => m.code === code);
}
