import { apiGet, buildQuery } from '@/lib/api-client';
import type { SalesDailyRow, OrderStatusRow, ProductPerformanceRow, InventorySnapshotRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatMoney, formatCompact } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { BarChartPanel } from '@/components/reports/charts/bar-chart-panel';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from './date-range';
import { DateRangeFilter } from './date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Executive Dashboard (plan/19 §6.1) — the reference implementation every
 * other /reports/* page mirrors: resolve the date range once, fetch every
 * analytics endpoint in parallel, sum/shape the rows for display. Currency
 * is summed across whatever currencies exist in range (documented MVP
 * simplification — see prisma-analytics-query.repository.ts's own header
 * comment); KPI cards deliberately carry no currency symbol as a result.
 */
export default async function ExecutiveReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [sales, orderStatus, topProducts, lowStock] = await Promise.all([
    apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${query}`),
    apiGet<OrderStatusRow[]>(`/admin/v1/analytics/order-status${query}`),
    apiGet<ProductPerformanceRow[]>(`/admin/v1/analytics/top-products${buildQuery({ ...range, limit: 5 })}`),
    apiGet<InventorySnapshotRow[]>(`/admin/v1/analytics/inventory/low-stock${buildQuery({ limit: 10 })}`),
  ]);

  const grossRevenue = sales.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
  const netRevenue = sales.reduce((sum, r) => sum + Number(r.netRevenue), 0);
  const refundTotal = sales.reduce((sum, r) => sum + Number(r.refundTotal), 0);
  const orderCount = sales.reduce((sum, r) => sum + r.orderCount, 0);
  const newCustomerCount = sales.reduce((sum, r) => sum + r.newCustomerCount, 0);
  const aov = orderCount > 0 ? netRevenue / orderCount : 0;

  // One row per calendar day, gross+net summed across every currency/website bucket that day.
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
  const statusData = [...statusByStatus.entries()].map(([label, value]) => ({ label, value }));

  const productData = topProducts.map((p) => ({ label: p.productName ?? p.sku ?? `#${p.productId}`, value: Number(p.revenue) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <DateRangeFilter basePath="/reports" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Gross revenue" value={formatMoney(grossRevenue.toString())} />
        <StatCard label="Net revenue" value={formatMoney(netRevenue.toString())} />
        <StatCard label="Orders" value={formatCompact(orderCount)} />
        <StatCard label="Avg order value" value={formatMoney(aov.toString())} />
        <StatCard label="New customers" value={formatCompact(newCustomerCount)} />
        <StatCard label="Refunds" value={formatMoney(refundTotal.toString())} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>{statusData.length > 0 ? <BarChartPanel data={statusData} orientation="columns" /> : <ChartEmptyState />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 products by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {productData.length > 0 ? <BarChartPanel data={productData} orientation="bars" format="compact" /> : <ChartEmptyState />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention — low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder point</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((row, i) => (
                    <TableRow key={`${row.variantId}-${row.warehouseId}-${i}`}>
                      <TableCell>{row.productName ?? row.sku ?? row.variantId}</TableCell>
                      <TableCell>{row.warehouseName ?? row.warehouseId}</TableCell>
                      <TableCell className="text-right">{row.available}</TableCell>
                      <TableCell className="text-right">{row.reorderPoint ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing is below its reorder point right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}
