import Link from 'next/link';
import Form from 'next/form';
import { Target } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { MerchandisingSuggestionList } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { DotBadge } from '@/components/dot-badge';
import { cn } from '@/lib/utils';
import { RefreshSuggestionsButton } from './refresh-button';

const DEFAULT_PAGE_SIZE = 20;
const KINDS = ['RESTOCK', 'PROMOTE_SLOW_MOVER', 'FEATURE_TRENDING_CATEGORY'] as const;
const CONFIDENCES = ['high', 'medium', 'low'] as const;

const nativeSelectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

// A merchandising action, not a risk level — 'success'/'warning'/'info'
// read more naturally here than the destructive/warning/success mapping
// Forecasting's risk tiers use, even though the badge component is the
// same DotBadge primitive.
const KIND_LABEL: Record<string, string> = {
  RESTOCK: 'Restock',
  PROMOTE_SLOW_MOVER: 'Promote',
  FEATURE_TRENDING_CATEGORY: 'Feature',
};
const KIND_BADGE_VARIANT: Record<string, 'destructive' | 'warning' | 'success'> = {
  RESTOCK: 'destructive',
  PROMOTE_SLOW_MOVER: 'warning',
  FEATURE_TRENDING_CATEGORY: 'success',
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-status-good',
  medium: 'bg-status-warning',
  low: 'bg-status-critical',
};

interface RecommendationsSearchParams {
  page?: string;
  pageSize?: string;
  kind?: string;
  confidence?: string;
}

/**
 * The last of the original 4 AI nav items. Same "explainable, not a model
 * guess" philosophy as Insights/Forecasting (see src/modules/ai/
 * infrastructure/prisma-merchandising-suggestion.repository.ts's own
 * header comment) — 3 plain rules, 2 of which read Forecasting's own
 * already-computed output directly rather than re-deriving it. Card list,
 * closer to Insights' shape than Forecasting's table, since each
 * suggestion needs a rationale sentence, not just a numeric row.
 */
export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<RecommendationsSearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const pageSize = params.pageSize ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;

  const baseFilters = { kind: params.kind, confidence: params.confidence, pageSize };
  const list = await apiGet<MerchandisingSuggestionList>(`/admin/v1/ai/recommendations${buildQuery({ ...baseFilters, page })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasFilters = Boolean(params.kind || params.confidence);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[1.32rem] font-extrabold tracking-tight">
            <Target className="size-5 text-primary" />
            Recommendations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.total} suggestion{list.total === 1 ? '' : 's'} — refreshed nightly, right after Forecasting
          </p>
        </div>
        <RefreshSuggestionsButton />
      </div>

      <Form id="recommendations-filters" className="mt-6 flex flex-wrap items-center gap-2" action="/ai/recommendations">
        <select name="kind" defaultValue={params.kind ?? ''} className={nativeSelectClass}>
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select name="confidence" defaultValue={params.confidence ?? ''} className={nativeSelectClass}>
          <option value="">All confidence levels</option>
          {CONFIDENCES.map((c) => (
            <option key={c} value={c}>
              {c[0]!.toUpperCase() + c.slice(1)} confidence
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters ? (
          <Link href="/ai/recommendations" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            Clear
          </Link>
        ) : null}
      </Form>

      <div className="mt-6">
        {list.suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {hasFilters ? 'No suggestions match these filters.' : 'No suggestions yet — click "Refresh now" above, or check back after tonight\'s automatic refresh.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.suggestions.map((s) => (
              <div key={s.publicId} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5">
                  <DotBadge variant={KIND_BADGE_VARIANT[s.kind]}>{KIND_LABEL[s.kind]}</DotBadge>
                  <span className="ml-auto inline-flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                    <span className={cn('size-1.5 rounded-full', CONFIDENCE_DOT[s.confidence])} />
                    {s.confidence} confidence
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{s.headline}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Link href={s.actionHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                    {s.actionLabel}
                  </Link>
                  <span className="text-[0.68rem] text-muted-foreground">{s.targetName ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.suggestions.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + list.suggestions.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/ai/recommendations${buildQuery({ ...baseFilters, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
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
            <Link href={`/ai/recommendations${buildQuery({ ...baseFilters, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
