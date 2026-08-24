import { apiGet, buildQuery } from '@/lib/api-client';
import type { OrderStatusRow, FulfillmentDailyRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatCompact } from '@/components/reports/stat-card';
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
 * Orders Dashboard (plan/19 §6.x) — mirrors the Executive dashboard's shape:
 * resolve the date range once, fetch every analytics endpoint in parallel,
 * sum/shape the rows for display. avgDeliveryHours is always null today (a
 * documented gap in the fulfillment pipeline) — rendered as "—" rather than
 * hidden, so the column stays ready for when the data exists.
 */
export default async function OrdersReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [orderStatus, fulfillment] = await Promise.all([
    apiGet<OrderStatusRow[]>(`/admin/v1/analytics/order-status${query}`),
    apiGet<FulfillmentDailyRow[]>(`/admin/v1/analytics/fulfillment${query}`),
  ]);

  const totalOrders = orderStatus.reduce((sum, r) => sum + r.orderCount, 0);
  const cancelledOrders = orderStatus.reduce((sum, r) => (r.status === 'CANCELLED' ? sum + r.orderCount : sum), 0);
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  const ordersProcessed = fulfillment.reduce((sum, r) => sum + r.ordersProcessed, 0);

  const processingValues = fulfillment.map((r) => r.avgProcessingHours).filter((v): v is string => v !== null).map(Number);
  const avgProcessingHours = processingValues.length > 0 ? processingValues.reduce((a, b) => a + b, 0) / processingValues.length : null;

  const shippingValues = fulfillment.map((r) => r.avgShippingHours).filter((v): v is string => v !== null).map(Number);
  const avgShippingHours = shippingValues.length > 0 ? shippingValues.reduce((a, b) => a + b, 0) / shippingValues.length : null;

  const statusByStatus = new Map<string, number>();
  for (const r of orderStatus) statusByStatus.set(r.status, (statusByStatus.get(r.status) ?? 0) + r.orderCount);
  const statusData = [...statusByStatus.entries()].map(([label, value]) => ({ label, value }));

  const trendData = [...fulfillment]
    .sort((a, b) => a.dateKey - b.dateKey)
    .map((r) => ({ x: formatDateKey(r.dateKey), orders: r.ordersProcessed }));

  const tableRows = [...fulfillment].sort((a, b) => b.dateKey - a.dateKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Order Dashboard</h1>
        <DateRangeFilter basePath="/reports/orders" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total orders" value={formatCompact(totalOrders)} />
        <StatCard label="Cancelled" value={formatCompact(cancelledOrders)} />
        <StatCard label="Cancellation rate" value={`${cancellationRate.toFixed(1)}%`} />
        <StatCard label="Orders processed" value={formatCompact(ordersProcessed)} />
        <StatCard label="Avg processing hrs" value={avgProcessingHours !== null ? avgProcessingHours.toFixed(1) : '—'} />
        <StatCard label="Avg shipping hrs" value={avgShippingHours !== null ? avgShippingHours.toFixed(1) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>{statusData.length > 0 ? <BarChartPanel data={statusData} orientation="columns" format="plain" /> : <ChartEmptyState />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders processed trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <TrendLineChart
                data={trendData}
                series={[{ key: 'orders', label: 'Orders processed', colorVar: 'var(--chart-1)' }]}
                format="plain"
              />
            ) : (
              <ChartEmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fulfillment by day</CardTitle>
        </CardHeader>
        <CardContent>
          {tableRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Orders processed</TableHead>
                  <TableHead className="text-right">Avg processing (hrs)</TableHead>
                  <TableHead className="text-right">Avg shipping (hrs)</TableHead>
                  <TableHead className="text-right">Avg delivery (hrs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.dateKey}>
                    <TableCell>{formatDateKey(row.dateKey)}</TableCell>
                    <TableCell className="text-right">{row.ordersProcessed}</TableCell>
                    <TableCell className="text-right">{formatHours(row.avgProcessingHours)}</TableCell>
                    <TableCell className="text-right">{formatHours(row.avgShippingHours)}</TableCell>
                    <TableCell className="text-right">{formatHours(row.avgDeliveryHours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No fulfillment activity in this date range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatHours(value: string | null): string {
  return value !== null ? Number(value).toFixed(1) : '—';
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}
