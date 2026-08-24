import { apiGet, buildQuery } from '@/lib/api-client';
import type { RfmSegmentCount, CustomerActivityRow, TopCustomerRow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatMoney, formatCompact } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { BarChartPanel } from '@/components/reports/charts/bar-chart-panel';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../date-range';
import { DateRangeFilter } from '../date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Customers Dashboard (plan/19 §6) — new vs returning activity and top
 * spenders are date-scoped like every other /reports/* page, but the RFM
 * segment breakdown is a current-state snapshot (the /customers/rfm
 * endpoint takes no dateFrom/dateTo at all) — called once, outside the
 * date-scoped Promise.all group's query string, and called out in its own
 * card so it doesn't read as if the date filter above controls it too.
 */
export default async function CustomersReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [rfmSegments, activity, topCustomers] = await Promise.all([
    apiGet<RfmSegmentCount[]>('/admin/v1/analytics/customers/rfm'),
    apiGet<CustomerActivityRow[]>(`/admin/v1/analytics/customers/activity${query}`),
    apiGet<TopCustomerRow[]>(`/admin/v1/analytics/customers/top${buildQuery({ ...range, limit: 10 })}`),
  ]);

  const newCustomers = activity.reduce((sum, r) => sum + r.newCustomers, 0);
  const returningCustomers = activity.reduce((sum, r) => sum + r.returningCustomers, 0);
  const totalOrders = activity.reduce((sum, r) => sum + r.totalOrders, 0);
  const totalRevenue = activity.reduce((sum, r) => sum + Number(r.totalRevenue), 0);

  const activityTrend = [...activity]
    .sort((a, b) => a.dateKey - b.dateKey)
    .map((r) => ({ x: formatDateKey(r.dateKey), newCustomers: r.newCustomers, returningCustomers: r.returningCustomers }));

  const segmentData = rfmSegments.map((s) => ({ label: s.segment, value: s.customerCount }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Customer Dashboard</h1>
        <DateRangeFilter basePath="/reports/customers" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="New customers" value={formatCompact(newCustomers)} />
        <StatCard label="Returning customers" value={formatCompact(returningCustomers)} />
        <StatCard label="Total orders" value={formatCompact(totalOrders)} />
        <StatCard label="Total revenue" value={formatMoney(totalRevenue.toString())} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New vs returning customers</CardTitle>
          </CardHeader>
          <CardContent>
            {activityTrend.length > 0 ? (
              <TrendLineChart
                data={activityTrend}
                series={[
                  { key: 'newCustomers', label: 'New', colorVar: 'var(--chart-1)' },
                  { key: 'returningCustomers', label: 'Returning', colorVar: 'var(--chart-2)' },
                ]}
                format="plain"
              />
            ) : (
              <ChartEmptyState />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer segments (RFM)</CardTitle>
            <CardDescription>Current segment distribution, not scoped to the date range above.</CardDescription>
          </CardHeader>
          <CardContent>
            {segmentData.length > 0 ? <BarChartPanel data={segmentData} orientation="columns" format="plain" /> : <ChartEmptyState />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top customers by revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {topCustomers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Orders placed</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((c) => (
                  <TableRow key={c.customerId}>
                    <TableCell>{c.name ?? c.email ?? `Customer #${c.customerId}`}</TableCell>
                    <TableCell>{c.email ?? '—'}</TableCell>
                    <TableCell className="text-right">{c.ordersPlaced}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No customer activity in this date range.</p>
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
