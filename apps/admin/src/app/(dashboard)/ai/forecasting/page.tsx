import Link from 'next/link';
import Form from 'next/form';
import { Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { ProductForecastList } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DotBadge } from '@/components/dot-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshForecastsButton } from './refresh-button';

const DEFAULT_PAGE_SIZE = 20;
const RISK_TIERS = ['high', 'medium', 'low'] as const;

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const RISK_BADGE_VARIANT: Record<string, 'destructive' | 'warning' | 'success'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'success',
};

interface ForecastingSearchParams {
  page?: string;
  pageSize?: string;
  riskTier?: string;
}

/**
 * A statistical, product-grain forecast — same "explainable, not a model
 * guess" philosophy as AI Insights (src/modules/ai/infrastructure/
 * prisma-product-forecast.repository.ts's own header comment): a plain
 * trailing-14-day moving average and 7-vs-7 trend, refreshed nightly
 * (or on demand via "Refresh now", same pattern as /ai/insights).
 * Table, not a card grid — unlike Insights' narrative headlines, this is
 * inherently a set of numeric columns to scan and sort by.
 */
export default async function ForecastingPage({ searchParams }: { searchParams: Promise<ForecastingSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;

  const baseFilters = { riskTier: params.riskTier, pageSize };
  const list = await apiGet<ProductForecastList>(`/admin/v1/ai/forecasts${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.riskTier);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[1.32rem] font-extrabold tracking-tight">
            <Radar className="size-5 text-primary" />
            Forecasting
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} product{list.total === 1 ? '' : 's'} with a real sales trend — refreshed nightly from your last 14 days
          </p>
        </div>
        <RefreshForecastsButton />
      </div>

      <Form id="forecasting-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/ai/forecasting">
        <select name="riskTier" defaultValue={params.riskTier ?? ''} className={nativeSelectClass}>
          <option value="">All risk levels</option>
          {RISK_TIERS.map((t) => (
            <option key={t} value={t}>
              {t[0]!.toUpperCase() + t.slice(1)} risk
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/ai/forecasting" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Avg. daily sales</TableHead>
              <TableHead>Trend (7d vs. prior 7d)</TableHead>
              <TableHead className="text-right">Stock on hand</TableHead>
              <TableHead className="text-right">Days of cover</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.forecasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {hasFilters ? 'No products match this filter.' : 'No forecastable products yet — click "Refresh now" above, or check back after tonight\'s automatic refresh.'}
                </TableCell>
              </TableRow>
            ) : (
              list.forecasts.map((f) => (
                <TableRow key={f.publicId}>
                  <TableCell>
                    {/* publicId (UUID), not the internal productId — every
                        real /products/:id route is keyed by publicId (see
                        every list page's own router.push convention); a
                        real bug, linking with the internal id 404s. Falls
                        back to plain text if the product's since been
                        deleted (LEFT JOIN returns null). */}
                    {f.productPublicId ? (
                      <Link href={`/products/${f.productPublicId}`} className="font-medium text-foreground hover:underline">
                        {f.productName ?? '—'}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{f.productName ?? '—'}</span>
                    )}
                    <div className="text-xs text-muted-foreground">{f.sku}</div>
                  </TableCell>
                  <TableCell className="text-right">{Number(f.avgDailySellRate).toFixed(2)} units/day</TableCell>
                  <TableCell>
                    {f.trendPct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={cn('inline-flex items-center gap-1', Number(f.trendPct) >= 0 ? 'text-status-good' : 'text-status-critical')}>
                        {Number(f.trendPct) >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        {Math.abs(Number(f.trendPct)).toFixed(1)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{f.currentStock}</TableCell>
                  <TableCell className="text-right">{f.daysOfCover === null ? '—' : `${Number(f.daysOfCover).toFixed(1)}d`}</TableCell>
                  <TableCell>
                    <DotBadge variant={RISK_BADGE_VARIANT[f.riskTier]}>{f.riskTier}</DotBadge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.forecasts.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + list.forecasts.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/ai/forecasting${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Previous
            </Link>
          )}
          <span className="px-1">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={`/ai/forecasting${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
