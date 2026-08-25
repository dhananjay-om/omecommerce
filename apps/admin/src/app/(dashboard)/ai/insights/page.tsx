import Link from 'next/link';
import Form from 'next/form';
import { Sparkles } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { AiInsightList } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshInsightsButton } from './refresh-button';

const DEFAULT_PAGE_SIZE = 20;
const CATEGORIES = ['Sales', 'Inventory', 'Orders', 'Customers', 'Fulfillment'];
const IMPACTS = ['high', 'medium', 'low'] as const;

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const IMPACT_DOT: Record<string, string> = {
  high: 'bg-status-critical',
  medium: 'bg-status-warning',
  low: 'bg-status-good',
};

function formatDateKey(dateKey: number): string {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

interface AiInsightsSearchParams {
  page?: string;
  pageSize?: string;
  category?: string;
  impact?: string;
}

/**
 * The exhaustive, persisted version of the Dashboard's own "Insights" card
 * (dashboard/ai-insights.tsx) — same rule-based philosophy (every headline
 * here is a plain threshold rule over real numbers, not model-generated
 * text; see src/modules/ai/infrastructure/prisma-ai-insight.repository.ts's
 * own header comment for the rule library), same card visual, but not
 * capped at 4 and not just "right now" — a real paginated, filterable list
 * refreshed nightly from the last 7 days' trend vs. the 7 before it.
 */
export default async function AiInsightsPage({ searchParams }: { searchParams: Promise<AiInsightsSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;

  const baseFilters = { category: params.category, impact: params.impact, pageSize };
  const list = await apiGet<AiInsightList>(`/admin/v1/ai/insights${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.category || params.impact);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[1.32rem] font-extrabold tracking-tight">
            <Sparkles className="size-5 text-primary" />
            AI Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} insight{list.total === 1 ? '' : 's'} — refreshed nightly from your last 7 days of activity
          </p>
        </div>
        <RefreshInsightsButton />
      </div>

      <Form id="ai-insights-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/ai/insights">
        <select name="category" defaultValue={params.category ?? ''} className={nativeSelectClass}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="impact" defaultValue={params.impact ?? ''} className={nativeSelectClass}>
          <option value="">All impact levels</option>
          {IMPACTS.map((i) => (
            <option key={i} value={i}>
              {i[0]!.toUpperCase() + i.slice(1)} impact
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/ai/insights" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        {list.insights.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {hasFilters ? 'No insights match these filters.' : 'No insights yet — click "Refresh now" above, or check back after tonight\'s automatic refresh.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.insights.map((insight) => (
              // Same visual as the Dashboard's own Insights card
              // (dashboard/ai-insights.tsx) — a plain bordered div, not the
              // full `Card` primitive, so this list of many reads
              // consistently with that page's "top 4" quick view rather
              // than looking like a heavier, different component.
              <div key={insight.publicId} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', IMPACT_DOT[insight.impact])} />
                  <span className="text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">{insight.impact} impact</span>
                  <span className="ml-auto text-[0.68rem] text-muted-foreground">{insight.category}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{insight.headline}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Link href={insight.actionHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                    {insight.actionLabel}
                  </Link>
                  <span className="text-[0.68rem] text-muted-foreground">{formatDateKey(insight.dateKey)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.insights.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + list.insights.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/ai/insights${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/ai/insights${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
