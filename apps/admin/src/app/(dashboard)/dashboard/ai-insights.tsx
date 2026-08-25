import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Insight {
  impact: 'high' | 'medium' | 'low';
  category: string;
  headline: string;
  actionLabel: string;
  actionHref: string;
}

const IMPACT_DOT: Record<Insight['impact'], string> = {
  high: 'bg-status-critical',
  medium: 'bg-status-warning',
  low: 'bg-status-good',
};

/**
 * "AI Insights" — matches the mock's card shape (impact badge, category,
 * headline, one primary action), but every headline here is a plain
 * rule computed from real numbers already on this page (a revenue swing,
 * a low-stock count, a refund-rate change — see dashboard/page.tsx's
 * `buildInsights`), not model-generated text. There's no real AI backend
 * in this system yet (nav-data.ts's whole AI group is "Coming soon"), so
 * this reads as "notable things about your real data today," not a
 * feature this system doesn't have. Renders nothing if no rule triggered
 * — no padding with filler cards to hit a fixed count.
 */
export function AiInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[0.88rem] font-bold">
            <Sparkles className="size-3.5 text-primary" />
            Insights
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Notable changes in your store&apos;s real data this period</p>
        </div>
      </div>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {insights.map((insight, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', IMPACT_DOT[insight.impact])} />
              <span className="text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">{insight.impact} impact</span>
              <span className="ml-auto text-[0.68rem] text-muted-foreground">{insight.category}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{insight.headline}</p>
            <Link href={insight.actionHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
              {insight.actionLabel}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
