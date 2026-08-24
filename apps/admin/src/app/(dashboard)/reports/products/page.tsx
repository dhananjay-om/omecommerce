import { apiGet, buildQuery } from '@/lib/api-client';
import type { ProductPerformanceRow, CategoryPerformanceRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatMoney, formatCompact } from '@/components/reports/stat-card';
import { BarChartPanel } from '@/components/reports/charts/bar-chart-panel';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../date-range';
import { DateRangeFilter } from '../date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Product Dashboard (plan/19 §6.x) — mirrors the Executive dashboard's
 * shape: resolve the date range once, fetch every analytics endpoint in
 * parallel, sum/shape the rows for display.
 */
export default async function ProductReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);

  const [topProducts, topCategories] = await Promise.all([
    apiGet<ProductPerformanceRow[]>(`/admin/v1/analytics/top-products${buildQuery({ ...range, limit: 15 })}`),
    apiGet<CategoryPerformanceRow[]>(`/admin/v1/analytics/top-categories${buildQuery({ ...range, limit: 10 })}`),
  ]);

  const totalUnitsSold = topProducts.reduce((sum, r) => sum + r.unitsSold, 0);
  const totalRevenue = topProducts.reduce((sum, r) => sum + Number(r.revenue), 0);

  const productRevenueData = topProducts.map((p) => ({
    label: p.productName ?? p.sku ?? `#${p.productId}`,
    value: Number(p.revenue),
  }));

  const categoryRevenueData = topCategories.map((c) => ({
    label: c.categoryName ?? `#${c.categoryId}`,
    value: Number(c.revenue),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Product Dashboard</h1>
        <DateRangeFilter basePath="/reports/products" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Products with sales" value={formatCompact(topProducts.length)} />
        <StatCard label="Total units sold" value={formatCompact(totalUnitsSold)} />
        <StatCard label="Total revenue" value={formatMoney(totalRevenue.toString())} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top products by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {productRevenueData.length > 0 ? (
              <BarChartPanel data={productRevenueData} orientation="bars" format="compact" />
            ) : (
              <ChartEmptyState />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top categories by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryRevenueData.length > 0 ? (
              <BarChartPanel data={categoryRevenueData} orientation="bars" format="compact" />
            ) : (
              <ChartEmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top products</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((row, i) => (
                  <TableRow key={row.productId}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{row.productName ?? row.sku ?? `#${row.productId}`}</TableCell>
                    <TableCell>{row.sku ?? '—'}</TableCell>
                    <TableCell className="text-right">{row.unitsSold}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
                    <TableCell className="text-right">{row.orderCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No product sales in this date range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
