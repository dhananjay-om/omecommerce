import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Prisma } from '@prisma/client';
import type { AnalyticsQueryRepository, DateRange } from '../../analytics/domain/queries.js';
import { parseDateKey } from '../../analytics/domain/date-key.js';

/** One OpenAI function tool per useful AnalyticsQueryRepository read — no
 *  new aggregation logic, this just exposes what /admin/v1/analytics/*
 *  already computes to the model as callable tools. Every tool is
 *  READ-ONLY by construction (the whole repository is a read port — see
 *  its own header comment) — there is no destructive-action risk from the
 *  model calling one, not because of a filter that could be gotten wrong.
 *  Skipped on purpose: getReconciliationLog (an ops-internal tool, not a
 *  "business question" a merchant would ask in chat) and the
 *  countLowStock/countOutOfStock scalars (getLowStockNow already covers
 *  that with real SKU-level detail). */

const DATE_PARAMS = {
  dateFrom: { type: 'string', description: 'Start date, YYYY-MM-DD (inclusive).' },
  dateTo: { type: 'string', description: 'End date, YYYY-MM-DD (inclusive).' },
} as const;

export const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_sales_trend',
      description: 'Daily revenue, order count, units sold, and new-customer count over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description: 'Best-selling products by revenue over a date range.',
      parameters: {
        type: 'object',
        properties: { ...DATE_PARAMS, limit: { type: 'number', description: 'Max products to return, default 10.' } },
        required: ['dateFrom', 'dateTo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_categories',
      description: 'Best-selling categories by revenue over a date range.',
      parameters: {
        type: 'object',
        properties: { ...DATE_PARAMS, limit: { type: 'number', description: 'Max categories to return, default 10.' } },
        required: ['dateFrom', 'dateTo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status_breakdown',
      description: 'Order counts by status (PENDING, PROCESSING, CANCELLED, etc.) over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_method_breakdown',
      description: 'Payment success/failure counts and amounts by method and gateway over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_returns_trend',
      description: 'Daily return count, quantity, and refunded amount over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fulfillment_trend',
      description: 'Daily orders processed and average processing/shipping time over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_now',
      description: 'SKUs that are low on stock right now (available <= reorder point), live — not historical.',
      parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max SKUs to return, default 50.' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_activity_trend',
      description: 'Daily new-vs-returning customer counts, order count, and revenue over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_customers',
      description: 'Top customers by revenue over a date range.',
      parameters: {
        type: 'object',
        properties: { ...DATE_PARAMS, limit: { type: 'number', description: 'Max customers to return, default 10.' } },
        required: ['dateFrom', 'dateTo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rfm_segments',
      description: 'Current customer count per RFM segment (CHAMPION, LOYAL, AT_RISK, LOST, NEW, REGULAR) — a snapshot, not date-ranged.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inventory_trend',
      description: 'Daily total on-hand/reserved/available stock and low-stock count over a date range.',
      parameters: { type: 'object', properties: { ...DATE_PARAMS }, required: ['dateFrom', 'dateTo'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_stuck_orders',
      description: 'Count of orders that reached PROCESSING/CONFIRMED and have sat there without closing out — live, right now.',
      parameters: { type: 'object', properties: { daysThreshold: { type: 'number', description: 'How many days is "stuck", default 3.' } } },
    },
  },
];

/** Maps a tool name to the report page an answer that used it should link
 *  to — apps/admin's /ai/assistant page renders these as "View full
 *  report" chips under an answer, per nav-data.ts's own planned copy
 *  ("Direct links from an answer into the relevant report"). */
export const TOOL_REPORT_LINKS: Record<string, { label: string; href: string }> = {
  get_sales_trend: { label: 'View Sales Report', href: '/reports/sales' },
  get_top_products: { label: 'View Products Report', href: '/reports/products' },
  get_top_categories: { label: 'View Products Report', href: '/reports/products' },
  get_order_status_breakdown: { label: 'View Orders Report', href: '/reports/orders' },
  get_payment_method_breakdown: { label: 'View Orders Report', href: '/reports/orders' },
  get_returns_trend: { label: 'View Orders Report', href: '/reports/orders' },
  get_fulfillment_trend: { label: 'View Orders Report', href: '/reports/orders' },
  get_low_stock_now: { label: 'View Inventory', href: '/inventory' },
  get_customer_activity_trend: { label: 'View Customers Report', href: '/reports/customers' },
  get_top_customers: { label: 'View Customers Report', href: '/reports/customers' },
  get_rfm_segments: { label: 'View Customers Report', href: '/reports/customers' },
  get_inventory_trend: { label: 'View Inventory Report', href: '/reports/inventory' },
  count_stuck_orders: { label: 'View Orders', href: '/orders?status=PROCESSING' },
};

/** BigInt values (customerId, productId, ...) can't cross JSON.stringify —
 *  the model only needs them as readable numbers/strings anyway. Also
 *  special-cases Prisma.Decimal: despite AnalyticsQueryRepository's own
 *  types claiming money fields (grossRevenue, revenue, ...) are `string`,
 *  they come back as real Decimal instances at runtime — found by actually
 *  running this against real data, not assumed from the types. A generic
 *  object walk (Object.entries on a Decimal) serializes its internal
 *  sign/exponent/digit-array representation instead of calling its own
 *  toString() — the model would see garbage like {"s":1,"e":4,"d":[11237]}
 *  instead of "1123.7" for every revenue figure, silently wrong in a way
 *  nothing downstream would catch. Must be checked BEFORE the generic
 *  object-recursion branch below, not folded into it. */
function serializeForModel(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(serializeForModel);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeForModel(v)]));
  }
  return value;
}

function toRange(args: { dateFrom?: string; dateTo?: string }): DateRange {
  if (!args.dateFrom || !args.dateTo) throw new Error('dateFrom and dateTo are required');
  return { fromDateKey: parseDateKey(args.dateFrom), toDateKey: parseDateKey(args.dateTo) };
}

/** Executes one tool call the model requested, against the real
 *  AnalyticsQueryRepository — no separate mock/stub path. Throws on an
 *  unknown tool name (should be unreachable — the model can only request
 *  names from ASSISTANT_TOOLS above) or bad args; the caller (ChatWithAssistant)
 *  is responsible for turning that into a tool-result message the model can
 *  see and recover from, rather than crashing the whole conversation. */
export async function dispatchAssistantTool(name: string, args: Record<string, unknown>, analytics: AnalyticsQueryRepository): Promise<unknown> {
  const a = args as { dateFrom?: string; dateTo?: string; limit?: number; daysThreshold?: number };
  switch (name) {
    case 'get_sales_trend':
      return serializeForModel(await analytics.getSalesTrend(toRange(a)));
    case 'get_top_products':
      return serializeForModel(await analytics.getTopProducts(toRange(a), a.limit ?? 10));
    case 'get_top_categories':
      return serializeForModel(await analytics.getTopCategories(toRange(a), a.limit ?? 10));
    case 'get_order_status_breakdown':
      return serializeForModel(await analytics.getOrderStatusBreakdown(toRange(a)));
    case 'get_payment_method_breakdown':
      return serializeForModel(await analytics.getPaymentMethodBreakdown(toRange(a)));
    case 'get_returns_trend':
      return serializeForModel(await analytics.getReturnsTrend(toRange(a)));
    case 'get_fulfillment_trend':
      return serializeForModel(await analytics.getFulfillmentTrend(toRange(a)));
    case 'get_low_stock_now':
      return serializeForModel(await analytics.getLowStockNow(a.limit ?? 50));
    case 'get_customer_activity_trend':
      return serializeForModel(await analytics.getCustomerActivityTrend(toRange(a)));
    case 'get_top_customers':
      return serializeForModel(await analytics.getTopCustomers(toRange(a), a.limit ?? 10));
    case 'get_rfm_segments':
      return serializeForModel(await analytics.getRfmSegments());
    case 'get_inventory_trend':
      return serializeForModel(await analytics.getInventoryTrend(toRange(a)));
    case 'count_stuck_orders':
      return { stuckOrders: await analytics.countStuckOrders(a.daysThreshold ?? 3) };
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
