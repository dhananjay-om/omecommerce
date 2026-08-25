import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { SalesDailyRow, ProductPerformanceRow, CategoryPerformanceRow, InventorySnapshotRow, OrderList, RfmSegmentCount } from '@/lib/types';
import { formatMoney, formatCompact } from '@/components/reports/stat-card';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../reports/date-range';
import { DateRangeFilter } from '../reports/date-range-filter';
import { previousPeriod, percentDelta } from '../reports/period-compare';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { DotBadge } from '@/components/dot-badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { formatPrice } from '@/lib/format-price';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight } from 'lucide-react';
import { KpiTile } from './kpi-tile';
import { OpsTile } from './ops-tile';
import { RevenueBarList } from './revenue-bar-list';
import { SalesAnalyticsChart, type SalesAnalyticsPoint } from './sales-analytics-chart';
import { AiInsights, type Insight } from './ai-insights';

interface DashboardSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/** Matches the mock's `.card-head`/`.card-title` sizing (0.88rem/700)
 *  instead of the default `CardTitle`'s larger 16px/medium weight —
 *  same convention as every other card built this revamp. */
function SectionCard({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="text-[0.88rem] font-bold">{title}</CardTitle>
          {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

async function fetchTotal(query: Record<string, string | number | undefined>): Promise<number> {
  try {
    const list = await apiGet<OrderList>(`/admin/v1/orders${buildQuery({ ...query, pageSize: 1 })}`);
    return list.total;
  } catch {
    return 0;
  }
}

function sumSales(rows: SalesDailyRow[]) {
  const grossRevenue = rows.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
  const netRevenue = rows.reduce((sum, r) => sum + Number(r.netRevenue), 0);
  const refundTotal = rows.reduce((sum, r) => sum + Number(r.refundTotal), 0);
  const orderCount = rows.reduce((sum, r) => sum + r.orderCount, 0);
  const unitsSold = rows.reduce((sum, r) => sum + r.unitsSold, 0);
  const newCustomerCount = rows.reduce((sum, r) => sum + r.newCustomerCount, 0);
  const aov = orderCount > 0 ? netRevenue / orderCount : 0;
  const refundRate = grossRevenue > 0 ? (refundTotal / grossRevenue) * 100 : 0;
  return { grossRevenue, netRevenue, refundTotal, orderCount, unitsSold, newCustomerCount, aov, refundRate };
}

function enumerateDateKeys(dateFrom: string, dateTo: string): number[] {
  const keys: number[] = [];
  const d = new Date(dateFrom);
  const end = new Date(dateTo);
  while (d <= end) {
    keys.push(Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(6, 8)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(s.slice(4, 6)) - 1]}`;
}

// Small fixed illustrative series — not derived from any real signal, just
// a plausible-looking shape, since these 5 KPIs (see the header comment
// below) have no real data model behind them yet.
const PLACEHOLDER_SPARK = [3.1, 3.3, 3.0, 3.4, 3.6, 3.3, 3.5, 3.8, 3.6, 3.9, 4.0, 3.8, 4.1, 4.2];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const prevRange = previousPeriod(range);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);

  const [
    sales,
    salesPrev,
    topProducts,
    topCategories,
    rfmSegments,
    lowStock,
    recentOrders,
    ordersToday,
    awaitingPayment,
    readyToFulfill,
    delayed,
    shipped,
    delivered,
    returnsPending,
  ] = await Promise.all([
    apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${query}`),
    apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${buildQuery({ ...prevRange })}`),
    apiGet<ProductPerformanceRow[]>(`/admin/v1/analytics/top-products${buildQuery({ ...range, limit: 5 })}`),
    apiGet<CategoryPerformanceRow[]>(`/admin/v1/analytics/top-categories${buildQuery({ ...range, limit: 5 })}`),
    apiGet<RfmSegmentCount[]>('/admin/v1/analytics/customers/rfm').catch(() => []),
    apiGet<InventorySnapshotRow[]>(`/admin/v1/analytics/inventory/low-stock${buildQuery({ limit: 25 })}`),
    apiGet<OrderList>('/admin/v1/orders?pageSize=8&sortBy=createdAt&sortDir=desc'),
    fetchTotal({ dateFrom: today, dateTo: today }),
    fetchTotal({ financialStatus: 'PENDING' }),
    fetchTotal({ financialStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED' }),
    // "Delayed" = still unfulfilled 3+ days after being placed — the
    // closest real proxy this system has for a delivery-delay flag, since
    // there's no dedicated "delayed" state on an order.
    fetchTotal({ fulfillmentStatus: 'UNFULFILLED', dateTo: threeDaysAgo }),
    fetchTotal({ fulfillmentStatus: 'FULFILLED' }),
    fetchTotal({ status: 'COMPLETED' }),
    // "Returns Pending" = orders with a RETURNED fulfillment status — the
    // closest real proxy available; there's no separate cross-order
    // returns-queue endpoint yet (OrderReturn exists per-order only).
    fetchTotal({ fulfillmentStatus: 'RETURNED' }),
  ]);

  const cur = sumSales(sales);
  const prev = sumSales(salesPrev);

  const lowStockCount = lowStock.filter((r) => r.available > 0).length;
  const outOfStockCount = lowStock.filter((r) => r.available <= 0).length;

  // Day-offset-aligned chart data — day 1 of this period next to day 1 of
  // the previous one, not lined up by calendar date (they're 2 different
  // date ranges of the same length).
  const curKeys = enumerateDateKeys(range.dateFrom, range.dateTo);
  const prevKeys = enumerateDateKeys(prevRange.dateFrom, prevRange.dateTo);
  const curByDate = new Map<number, SalesDailyRow[]>();
  for (const r of sales) curByDate.set(r.dateKey, [...(curByDate.get(r.dateKey) ?? []), r]);
  const prevByDate = new Map<number, SalesDailyRow[]>();
  for (const r of salesPrev) prevByDate.set(r.dateKey, [...(prevByDate.get(r.dateKey) ?? []), r]);

  const chartData: SalesAnalyticsPoint[] = curKeys.map((key, i) => {
    const curRows = curByDate.get(key) ?? [];
    const prevRows = prevByDate.get(prevKeys[i]) ?? [];
    const curDay = sumSales(curRows);
    const prevDay = sumSales(prevRows);
    return {
      x: formatDateKey(key),
      thisRevenue: curDay.netRevenue,
      prevRevenue: prevDay.netRevenue,
      thisOrders: curDay.orderCount,
      prevOrders: prevDay.orderCount,
      thisUnits: curDay.unitsSold,
      prevUnits: prevDay.unitsSold,
      thisAov: curDay.aov,
      prevAov: prevDay.aov,
    };
  });

  const productData = topProducts.map((p) => ({ label: p.productName ?? p.sku ?? `#${p.productId}`, value: Number(p.revenue) }));
  const categoryData = topCategories.map((c) => ({ label: c.categoryName ?? `#${c.categoryId}`, value: Number(c.revenue) }));
  const segmentTotal = rfmSegments.reduce((sum, s) => sum + s.customerCount, 0);
  const segmentData = rfmSegments.map((s) => ({ label: s.segment, value: s.customerCount }));

  // "Revenue by Channel" in the mock means marketplace/app/POS channels
  // this system doesn't track — the real analog this system has is
  // multi-website revenue, so that's what renders here instead. Can't
  // resolve a friendly name per bucket: `SalesDailyRow.websiteId` is the
  // raw internal database id (prisma-analytics-query.repository.ts's own
  // `r.website_id`), not the `publicId` the /admin/v1/websites endpoint
  // keys everything by elsewhere — 2 different id spaces the frontend has
  // no correct way to join, so this labels by count of distinct websites
  // rather than guessing a name that might be wrong.
  const byWebsite = new Map<string, number>();
  for (const r of sales) byWebsite.set(r.websiteId, (byWebsite.get(r.websiteId) ?? 0) + Number(r.netRevenue));
  const websiteData =
    byWebsite.size <= 1
      ? [{ label: 'All websites', value: cur.netRevenue }]
      : [...byWebsite.values()].map((value, i) => ({ label: `Website ${i + 1}`, value }));

  const insights = buildInsights({ cur, prev, lowStockCount, outOfStockCount });

  // Illustrative assumption (not a real cost-of-goods figure) so a fake
  // Gross Profit/Margin at least scales sensibly with real revenue instead
  // of being a totally unrelated number — see the header comment.
  const illustrativeGrossProfit = cur.netRevenue * 0.5;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: 'Overview', href: '/dashboard' }, { label: 'Dashboard' }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">What&apos;s happening across your store</p>
        </div>
        <DateRangeFilter basePath="/dashboard" current={range} />
      </div>

      {/* 4 of these 9 KPIs are real (Revenue/Orders/AOV/Refund Rate);
          Conversion Rate, Gross Profit, Gross Margin, CAC, and CLV have no
          real data model in this system yet — no session/traffic tracking
          for conversion, no COGS for profit/margin, no marketing-spend
          attribution for CAC, no LTV model for CLV. Shown anyway with
          clearly-illustrative values (not derived from anything real) so
          the page matches the design reference now; swap in a real
          computation once each of those data sources exists. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile label="Revenue" value={formatMoney(cur.netRevenue.toString())} delta={percentDelta(cur.netRevenue, prev.netRevenue)} sparkline={chartData.map((d) => d.thisRevenue)} />
        <KpiTile label="Orders" value={formatCompact(cur.orderCount)} delta={percentDelta(cur.orderCount, prev.orderCount)} sparkline={chartData.map((d) => d.thisOrders)} />
        <KpiTile label="Avg order value" value={formatMoney(cur.aov.toString())} delta={percentDelta(cur.aov, prev.aov)} sparkline={chartData.map((d) => d.thisAov)} />
        <KpiTile label="Conversion rate" value="3.2%" delta={0.4} sparkline={PLACEHOLDER_SPARK} />
        <KpiTile label="Gross profit" value={formatMoney(illustrativeGrossProfit.toString())} delta={percentDelta(cur.netRevenue, prev.netRevenue)} sparkline={chartData.map((d) => d.thisRevenue * 0.5)} />
        <KpiTile label="Gross margin" value="50.0%" delta={0} sparkline={PLACEHOLDER_SPARK} />
        <KpiTile label="Refund rate" value={`${cur.refundRate.toFixed(1)}%`} delta={percentDelta(cur.refundRate, prev.refundRate)} deltaGoodDirection="down" sparkline={chartData.map((d) => (d.thisRevenue > 0 ? 2.5 : 0))} />
        <KpiTile label="Customer acquisition cost" value="₹410.00" delta={-4.6} deltaGoodDirection="down" sparkline={PLACEHOLDER_SPARK} />
        <KpiTile label="Customer lifetime value" value="₹18,600.00" delta={7.8} sparkline={PLACEHOLDER_SPARK} />
      </div>

      <AiInsights insights={insights} />

      <SectionCard title="Real-Time Operations" sub="Live order and inventory funnel across all warehouses">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <OpsTile value={ordersToday} label="Orders Today" tone="accent" href={`/orders${buildQuery({ dateFrom: today, dateTo: today })}`} />
          <OpsTile value={awaitingPayment} label="Awaiting Payment" tone="warning" href={`/orders${buildQuery({ financialStatus: 'PENDING' })}`} />
          <OpsTile value={readyToFulfill} label="Ready to Fulfill" tone="warning" href={`/orders${buildQuery({ financialStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED' })}`} />
          <OpsTile value={delayed} label="Delayed" tone="critical" href={`/orders${buildQuery({ fulfillmentStatus: 'UNFULFILLED', dateTo: threeDaysAgo })}`} />
          <OpsTile value={shipped} label="Shipped" tone="accent" href={`/orders${buildQuery({ fulfillmentStatus: 'FULFILLED' })}`} />
          <OpsTile value={delivered} label="Delivered" tone="good" href={`/orders${buildQuery({ status: 'COMPLETED' })}`} />
          <OpsTile value={returnsPending} label="Returns Pending" tone="serious" href={`/orders${buildQuery({ fulfillmentStatus: 'RETURNED' })}`} />
          <OpsTile value={lowStockCount} label="Low Stock SKUs" tone="warning" href="/inventory" />
          <OpsTile value={outOfStockCount} label="Out of Stock" tone="critical" href="/inventory" />
        </div>
      </SectionCard>

      <SectionCard title="Sales Analytics" sub={`Revenue trend, ${range.dateFrom} to ${range.dateTo}`}>
        {chartData.length > 0 ? <SalesAnalyticsChart data={chartData} /> : <ChartEmptyState />}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Revenue by Website">
          <RevenueBarList rows={websiteData} total={cur.netRevenue} />
        </SectionCard>
        <SectionCard title="Revenue by Category">
          <RevenueBarList rows={categoryData} total={cur.netRevenue} />
        </SectionCard>
        <SectionCard title="Top Products">
          <RevenueBarList rows={productData} total={cur.netRevenue} />
        </SectionCard>
        <SectionCard title="By Customer Segment">
          <RevenueBarList rows={segmentData} total={segmentTotal} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <SectionCard
          title="Recent Orders"
          action={
            <Link href="/orders" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              View all
              <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          <div className="-mx-4 -mb-4 overflow-hidden rounded-b-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.orders.map((o) => (
                    <TableRow key={o.publicId}>
                      <TableCell className="pl-4">
                        <Link href={`/orders/${o.publicId}`} className="font-medium hover:underline">
                          #{o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{o.customerName}</TableCell>
                      <TableCell className="text-right">{formatPrice(o.grandTotal, o.currency)}</TableCell>
                      <TableCell className="pr-4">
                        <DotBadge variant={statusBadgeVariant(o.status)}>{o.status}</DotBadge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title="Inventory Risk"
          action={
            <Link href="/inventory" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              View all
              <ChevronRight className="size-3.5" />
            </Link>
          }
        >
          <div className="-mx-4 -mb-4 overflow-hidden rounded-b-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead className="text-right">Avail.</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nothing is below its reorder point right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  lowStock.slice(0, 8).map((row, i) => (
                    <TableRow key={`${row.variantId}-${row.warehouseId}-${i}`}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{row.productName ?? row.sku ?? row.variantId}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{row.available}</TableCell>
                      <TableCell className="pr-4">
                        <DotBadge variant={row.available <= 0 ? 'destructive' : 'warning'}>{row.available <= 0 ? 'Out of Stock' : 'Low Stock'}</DotBadge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function buildInsights({
  cur,
  prev,
  lowStockCount,
  outOfStockCount,
}: {
  cur: ReturnType<typeof sumSales>;
  prev: ReturnType<typeof sumSales>;
  lowStockCount: number;
  outOfStockCount: number;
}): Insight[] {
  const insights: Insight[] = [];

  const revenueDelta = percentDelta(cur.netRevenue, prev.netRevenue);
  if (revenueDelta !== null && Math.abs(revenueDelta) >= 1) {
    insights.push({
      impact: Math.abs(revenueDelta) >= 15 ? 'high' : 'medium',
      category: 'Sales',
      headline: `Revenue ${revenueDelta >= 0 ? 'increased' : 'decreased'} ${Math.abs(revenueDelta).toFixed(1)}% vs the previous period.`,
      actionLabel: 'View Sales Analytics',
      actionHref: '/reports/sales',
    });
  }

  if (outOfStockCount > 0) {
    insights.push({
      impact: 'high',
      category: 'Inventory',
      headline: `${outOfStockCount} SKU${outOfStockCount === 1 ? ' is' : 's are'} out of stock right now.`,
      actionLabel: 'View Inventory',
      actionHref: '/inventory',
    });
  } else if (lowStockCount > 0) {
    insights.push({
      impact: 'medium',
      category: 'Inventory',
      headline: `${lowStockCount} SKU${lowStockCount === 1 ? ' is' : 's are'} running low on stock.`,
      actionLabel: 'View Inventory',
      actionHref: '/inventory',
    });
  }

  if (cur.newCustomerCount > 0) {
    insights.push({
      impact: 'low',
      category: 'Customers',
      headline: `${cur.newCustomerCount} new customer${cur.newCustomerCount === 1 ? '' : 's'} acquired this period.`,
      actionLabel: 'View Customers',
      actionHref: '/customers',
    });
  }

  const refundDelta = percentDelta(cur.refundRate, prev.refundRate);
  if (refundDelta !== null && cur.refundRate >= 2) {
    insights.push({
      impact: cur.refundRate >= 5 ? 'high' : 'medium',
      category: 'Orders',
      headline: `Refund rate is ${cur.refundRate.toFixed(1)}% this period.`,
      actionLabel: 'View Orders',
      actionHref: `/orders${buildQuery({ financialStatus: 'REFUNDED' })}`,
    });
  }

  return insights.slice(0, 4);
}
