import { apiGet, buildQuery } from '@/lib/api-client';
import type { SalesDailyRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatMoney, formatCompact } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../date-range';
import { DateRangeFilter } from '../date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Sales Dashboard (plan/19 §6.x) — mirrors the Executive dashboard's shape:
 * resolve the date range once, fetch /analytics/sales, sum/shape the rows
 * for display. Currency is summed across whatever currencies exist in
 * range (documented MVP simplification, same as the Executive page — see
 * prisma-analytics-query.repository.ts's header comment); KPI cards
 * deliberately carry no currency symbol as a result.
 */
export default async function SalesReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const sales = await apiGet<SalesDailyRow[]>(`/admin/v1/analytics/sales${query}`);

  const grossRevenue = sales.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
  const netRevenue = sales.reduce((sum, r) => sum + Number(r.netRevenue), 0);
  const discountTotal = sales.reduce((sum, r) => sum + Number(r.discountTotal), 0);
  const taxTotal = sales.reduce((sum, r) => sum + Number(r.taxTotal), 0);
  const shippingTotal = sales.reduce((sum, r) => sum + Number(r.shippingTotal), 0);
  const refundTotal = sales.reduce((sum, r) => sum + Number(r.refundTotal), 0);
  const unitsSold = sales.reduce((sum, r) => sum + r.unitsSold, 0);

  // One row per calendar day, gross+net summed across every currency/website bucket that day.
  const byDate = new Map<number, { gross: number; net: number; units: number }>();
  for (const r of sales) {
    const acc = byDate.get(r.dateKey) ?? { gross: 0, net: 0, units: 0 };
    acc.gross += Number(r.grossRevenue);
    acc.net += Number(r.netRevenue);
    acc.units += r.unitsSold;
    byDate.set(r.dateKey, acc);
  }
  const sortedDates = [...byDate.entries()].sort(([a], [b]) => a - b);
  const revenueTrendData = sortedDates.map(([dateKey, v]) => ({ x: formatDateKey(dateKey), gross: v.gross, net: v.net }));
  const unitsTrendData = sortedDates.map(([dateKey, v]) => ({ x: formatDateKey(dateKey), units: v.units }));

  const breakdownRows = [...sales].sort((a, b) => b.dateKey - a.dateKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Sales Dashboard</h1>
        <DateRangeFilter basePath="/reports/sales" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Gross revenue" value={formatMoney(grossRevenue.toString())} />
        <StatCard label="Net revenue" value={formatMoney(netRevenue.toString())} />
        <StatCard label="Discounts" value={formatMoney(discountTotal.toString())} />
        <StatCard label="Tax" value={formatMoney(taxTotal.toString())} />
        <StatCard label="Shipping" value={formatMoney(shippingTotal.toString())} />
        <StatCard label="Refunds" value={formatMoney(refundTotal.toString())} />
        <StatCard label="Units sold" value={formatCompact(unitsSold)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueTrendData.length > 0 ? (
              <TrendLineChart
                data={revenueTrendData}
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
            <CardTitle>Units sold trend</CardTitle>
          </CardHeader>
          <CardContent>
            {unitsTrendData.length > 0 ? (
              <TrendLineChart data={unitsTrendData} series={[{ key: 'units', label: 'Units sold', colorVar: 'var(--chart-1)' }]} format="plain" />
            ) : (
              <ChartEmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdownRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Gross revenue</TableHead>
                  <TableHead className="text-right">Net revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownRows.map((row, i) => (
                  <TableRow key={`${row.dateKey}-${row.currency}-${row.websiteId}-${i}`}>
                    <TableCell>{formatDateKey(row.dateKey)}</TableCell>
                    <TableCell>{row.currency}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.grossRevenue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.netRevenue)}</TableCell>
                    <TableCell className="text-right">{row.orderCount}</TableCell>
                    <TableCell className="text-right">{row.unitsSold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No sales in this date range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}
