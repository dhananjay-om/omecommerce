import { apiGet, buildQuery } from '@/lib/api-client';
import type { CouponPerformanceRow, CouponRedemptionDailyRow, ReferralFunnelSummary, TopReferrerRow } from '@/lib/types';
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
 * Marketing Analytics (plan/19 §6.x) — mirrors the Sales page's shape.
 * Coupon money (discountAmount) is GROUPED BY CURRENCY by the API and must
 * never be summed across currency rows (see
 * prisma-analytics-query.repository.ts's header comment) — see
 * discountByCurrency() below, which renders one StatCard per currency
 * instead of a single (wrong) total whenever more than one appears.
 * Redemption/funnel counts, by contrast, are currency-agnostic and safe to
 * sum directly.
 */
export default async function MarketingReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const params = await searchParams;
  const range = resolveDateRange(params);
  const query = buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo });

  const [coupons, couponTrend, referralFunnel, topReferrers] = await Promise.all([
    apiGet<CouponPerformanceRow[]>(`/admin/v1/analytics/marketing/coupons${buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo, limit: 10 })}`),
    apiGet<CouponRedemptionDailyRow[]>(`/admin/v1/analytics/marketing/coupon-trend${query}`),
    apiGet<ReferralFunnelSummary>(`/admin/v1/analytics/marketing/referral-funnel${query}`),
    apiGet<TopReferrerRow[]>(`/admin/v1/analytics/marketing/top-referrers${buildQuery({ dateFrom: range.dateFrom, dateTo: range.dateTo, limit: 10 })}`),
  ]);

  const totalRedemptions = coupons.reduce((sum, r) => sum + r.redemptionCount, 0);
  const discountGroups = discountByCurrency(coupons);

  const qualifiedRate = formatRate(referralFunnel.qualifiedCount, referralFunnel.signedUpCount);
  const rewardedRate = formatRate(referralFunnel.rewardedCount, referralFunnel.qualifiedCount);

  // One row per calendar day, redemption COUNT summed across every currency
  // bucket that day — counts, unlike money, are safe to sum across currency.
  const byDate = new Map<number, number>();
  for (const r of couponTrend) {
    byDate.set(r.dateKey, (byDate.get(r.dateKey) ?? 0) + r.redemptionCount);
  }
  const sortedDates = [...byDate.entries()].sort(([a], [b]) => a - b);
  const redemptionTrendData = sortedDates.map(([dateKey, count]) => ({ x: formatDateKey(dateKey), redemptions: count }));

  const topCoupons = [...coupons].sort((a, b) => Number(b.discountAmount) - Number(a.discountAmount));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Marketing Analytics</h1>
        <DateRangeFilter basePath="/reports/marketing" current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Coupon redemptions" value={formatCompact(totalRedemptions)} />
        {discountGroups.map((g) => (
          <StatCard key={g.currency} label={discountGroups.length > 1 ? `Discount given (${g.currency})` : 'Discount given'} value={formatMoney(g.total.toString())} sub={discountGroups.length === 1 ? g.currency : undefined} />
        ))}
        <StatCard label="Signed up" value={formatCompact(referralFunnel.signedUpCount)} />
        <StatCard label="Qualified" value={formatCompact(referralFunnel.qualifiedCount)} sub={`Qualified rate: ${qualifiedRate}`} />
        <StatCard label="Rewarded" value={formatCompact(referralFunnel.rewardedCount)} sub={`Rewarded rate: ${rewardedRate}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coupon redemptions trend</CardTitle>
        </CardHeader>
        <CardContent>
          {redemptionTrendData.length > 0 ? (
            <TrendLineChart data={redemptionTrendData} series={[{ key: 'redemptions', label: 'Redemptions', colorVar: 'var(--chart-1)' }]} format="plain" />
          ) : (
            <ChartEmptyState />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top coupons</CardTitle>
          </CardHeader>
          <CardContent>
            {topCoupons.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Redemptions</TableHead>
                    <TableHead className="text-right">Discount given</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCoupons.map((row) => (
                    <TableRow key={row.couponId}>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell className="text-right">{row.redemptionCount}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.discountAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No coupon redemptions in this date range.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top referrers</CardTitle>
          </CardHeader>
          <CardContent>
            {topReferrers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead className="text-right">Qualified</TableHead>
                    <TableHead className="text-right">Rewarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReferrers.map((row) => (
                    <TableRow key={row.customerId}>
                      <TableCell>{row.name ?? row.email ?? row.customerId}</TableCell>
                      <TableCell className="text-right">{row.referralCount}</TableCell>
                      <TableCell className="text-right">{row.qualifiedCount}</TableCell>
                      <TableCell className="text-right">{row.rewardedCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No referrers in this date range.</p>
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

/** Guards against divide-by-zero (e.g. no signups yet in range) — returns an
 *  em dash rather than "NaN%" or "Infinity%". */
function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Groups discountAmount by currency — never sum decimal-string money
 *  across different currency rows (see this file's header comment). Returns
 *  one entry per currency present in `rows`, so the caller can render either
 *  a single "Discount given" card (1 currency) or one card per currency. */
function discountByCurrency(rows: CouponPerformanceRow[]): Array<{ currency: string; total: number }> {
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + Number(r.discountAmount));
  }
  return [...byCurrency.entries()].map(([currency, total]) => ({ currency, total }));
}
