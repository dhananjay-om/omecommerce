import { apiGet, buildQuery } from '@/lib/api-client';
import type { InventoryTrendRow, InventorySnapshotRow } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, formatCompact } from '@/components/reports/stat-card';
import { TrendLineChart } from '@/components/reports/charts/trend-line-chart';
import { ChartEmptyState } from '@/components/reports/chart-empty-state';
import { resolveDateRange } from '../date-range';
import { DateRangeFilter } from '../date-range-filter';

interface ReportSearchParams {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Inventory Dashboard (plan/19 §6.x) — mirrors the Executive dashboard's
 * shape. The stock-level trend is date-ranged like every other report, but
 * the low-stock table is a LIVE right-now snapshot (no dateFrom/dateTo) so
 * its KPI and table both come from the separate low-stock fetch, not from
 * the trend data — see the CardDescription below the low-stock table.
 */
export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [trend, lowStock] = await Promise.all([
    apiGet<InventoryTrendRow[]>(`/admin/v1/analytics/inventory/trend${query}`),
    apiGet<InventorySnapshotRow[]>(`/admin/v1/analytics/inventory/low-stock${buildQuery({ limit: 25 })}`),
  ]);

  const sortedTrend = [...trend].sort((a, b) => a.dateKey - b.dateKey);
  const latest = sortedTrend.length > 0 ? sortedTrend[sortedTrend.length - 1] : undefined;
  const onHand = latest?.totalOnHand ?? 0;
  const reserved = latest?.totalReserved ?? 0;
  const available = latest?.totalAvailable ?? 0;

  const trendData = sortedTrend.map((r) => ({
    x: formatDateKey(r.dateKey),
    onHand: r.totalOnHand,
    reserved: r.totalReserved,
    available: r.totalAvailable,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
        <DateRangeFilter basePath="/reports/inventory" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="On hand" value={formatCompact(onHand)} />
        <StatCard label="Reserved" value={formatCompact(reserved)} />
        <StatCard label="Available" value={formatCompact(available)} />
        <StatCard label="Low stock items right now" value={formatCompact(lowStock.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels over time</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <TrendLineChart
              data={trendData}
              series={[
                { key: 'onHand', label: 'On hand', colorVar: 'var(--chart-1)' },
                { key: 'reserved', label: 'Reserved', colorVar: 'var(--chart-3)' },
                { key: 'available', label: 'Available', colorVar: 'var(--chart-2)' },
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
          <CardTitle>Needs attention — low stock right now</CardTitle>
          <CardDescription>Live snapshot as of now — not affected by the date range above.</CardDescription>
        </CardHeader>
        <CardContent>
          {lowStock.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder point</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((row, i) => (
                  <TableRow key={`${row.variantId}-${row.warehouseId}-${i}`}>
                    <TableCell>{row.productName ?? row.variantId}</TableCell>
                    <TableCell>{row.sku ?? '—'}</TableCell>
                    <TableCell>{row.warehouseName ?? row.warehouseId}</TableCell>
                    <TableCell className="text-right">{row.onHand}</TableCell>
                    <TableCell className="text-right">{row.reserved}</TableCell>
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
  );
}

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`;
}
