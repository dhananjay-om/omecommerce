import Link from 'next/link';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { SalesDailyRow, OrderStatusRow, ProductPerformanceRow, CategoryPerformanceRow, InventorySnapshotRow, OrderList } from '@/lib/types';
import { StatCard, formatMoney, formatCompact } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { BarChartPanel } from '@/components/reports/charts/bar-chart-panel';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../reports/date-range';
import { DateRangeFilter } from '../reports/date-range-filter';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { DotBadge } from '@/components/dot-badge';
import { statusBadgeVariant } from '@/lib/status-badge';
import { formatPrice } from '@/lib/format-price';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight } from 'lucide-react';

interface DashboardSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

const STATUS_TILE_COLOR: Record<string, string> = {
  PENDING: 'text-status-warning',
  CONFIRMED: 'text-primary',
  PROCESSING: 'text-primary',
  ON_HOLD: 'text-status-serious',
  COMPLETED: 'text-status-good',
  CLOSED: 'text-muted-foreground',
  CANCELLED: 'text-status-critical',
};

/** Matches the mock's `.card-head`/`.card-title` sizing (0.88rem/700)
 *  instead of the default `CardTitle`'s larger 16px/medium weight —
 *  same convention as every other card built this revamp. */
function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between border-b pb-4">
        <CardTitle className="text-[0.88rem] font-bold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Dashboard — matches the mock's "Command Center" in shape (KPI row, order-
 * status operations tiles, revenue trend, "revenue by X" breakdowns, recent
 * orders + inventory risk) using the same real analytics endpoints the
 * Executive Report at /reports already proves out, restyled to this
 * revamp's conventions. The mock also carries Conversion Rate/Gross Profit/
 * Gross Margin/CAC/CLV KPIs and a 4-card "AI Insights" panel — none
 * included here: this system has no COGS/margin data, no marketing-spend
 * attribution, and no real AI backend (see nav-data.ts's AI group, all
 * "Coming soon") — not faked, same rule as everywhere else in this revamp.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [sales, orderStatus, topProducts, topCategories, lowStock, recentOrders] = await Promise.all([
    apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${query}`),
    apiGet<OrderStatusRow[]>(`/admin/v1/analytics/order-status${query}`),
    apiGet<ProductPerformanceRow[]>(`/admin/v1/analytics/top-products${buildQuery({ ...range, limit: 5 })}`),
    apiGet<CategoryPerformanceRow[]>(`/admin/v1/analytics/top-categories${buildQuery({ ...range, limit: 5 })}`),
    apiGet<InventorySnapshotRow[]>(`/admin/v1/analytics/inventory/low-stock${buildQuery({ limit: 8 })}`),
    apiGet<OrderList>('/admin/v1/orders?pageSize=8&sortBy=createdAt&sortDir=desc'),
  ]);

  const grossRevenue = sales.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
  const netRevenue = sales.reduce((sum, r) => sum + Number(r.netRevenue), 0);
  const refundTotal = sales.reduce((sum, r) => sum + Number(r.refundTotal), 0);
  const orderCount = sales.reduce((sum, r) => sum + r.orderCount, 0);
  const newCustomerCount = sales.reduce((sum, r) => sum + r.newCustomerCount, 0);
  const aov = orderCount > 0 ? netRevenue / orderCount : 0;

  const byDate = new Map<number, { gross: number; net: number }>();
  for (const r of sales) {
    const acc = byDate.get(r.dateKey) ?? { gross: 0, net: 0 };
    acc.gross += Number(r.grossRevenue);
    acc.net += Number(r.netRevenue);
    byDate.set(r.dateKey, acc);
  }
  const trendData = [...byDate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dateKey, v]) => ({ x: formatDateKey(dateKey), gross: v.gross, net: v.net }));

  const statusByStatus = new Map<string, number>();
  for (const r of orderStatus) statusByStatus.set(r.status, (statusByStatus.get(r.status) ?? 0) + r.orderCount);
  const statusTiles = [...statusByStatus.entries()].sort(([, a], [, b]) => b - a);

  const productData = topProducts.map((p) => ({ label: p.productName ?? p.sku ?? `#${p.productId}`, value: Number(p.revenue) }));
  const categoryData = topCategories.map((c) => ({ label: c.categoryName ?? `#${c.categoryId}`, value: Number(c.revenue) }));

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: 'Overview', href: '/dashboard' }, { label: 'Dashboard' }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.32rem] font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">What&apos;s happening across your store</p>
        </div>
        <DateRangeFilter basePath="/dashboard" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Gross revenue" value={formatMoney(grossRevenue.toString())} />
        <StatCard label="Net revenue" value={formatMoney(netRevenue.toString())} />
        <StatCard label="Orders" value={formatCompact(orderCount)} />
        <StatCard label="Avg order value" value={formatMoney(aov.toString())} />
        <StatCard label="New customers" value={formatCompact(newCustomerCount)} />
        <StatCard label="Refunds" value={formatMoney(refundTotal.toString())} />
      </div>

      <SectionCard title="Orders by Status">
        {statusTiles.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No orders in this date range.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {statusTiles.map(([status, count]) => (
              <Link key={status} href={`/orders${buildQuery({ status })}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className={`text-2xl font-bold tabular-nums ${STATUS_TILE_COLOR[status] ?? 'text-foreground'}`}>{formatCompact(count)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{status}</div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Revenue Trend">
        {trendData.length > 0 ? (
          <TrendLineChart
            data={trendData}
            series={[
              { key: 'gross', label: 'Gross revenue', colorVar: 'var(--chart-1)' },
              { key: 'net', label: 'Net revenue', colorVar: 'var(--chart-2)' },
            ]}
            format="compact"
          />
        ) : (
          <ChartEmptyState />
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Top Products by Revenue">
          {productData.length > 0 ? <BarChartPanel data={productData} orientation="bars" format="compact" /> : <ChartEmptyState />}
        </SectionCard>
        <SectionCard title="Top Categories by Revenue">
          {categoryData.length > 0 ? <BarChartPanel data={categoryData} orientation="bars" format="compact" /> : <ChartEmptyState />}
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
                  lowStock.map((row, i) => (
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

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}
