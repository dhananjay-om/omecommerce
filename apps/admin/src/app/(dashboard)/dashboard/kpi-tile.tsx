import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Tiny inline sparkline — deliberately NOT Recharts here: 9 of these
 *  render on one page, and a full ResponsiveContainer+chart per tile is a
 *  lot of overhead for what's just a trend shape at ~70x24px. A plain SVG
 *  polyline matches the dataviz skill's sparkline spec (a shape, not an
 *  axis-bearing chart) at a fraction of the cost. */
function Sparkline({ points, tone }: { points: number[]; tone: 'good' | 'bad' | 'neutral' }) {
  if (points.length < 2) return <div className="h-6 w-[70px]" aria-hidden="true" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 70;
  const h = 24;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(' ');
  const stroke = tone === 'good' ? 'var(--status-good)' : tone === 'bad' ? 'var(--status-critical)' : 'var(--muted-foreground)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  deltaGoodDirection = 'up',
  sparkline,
}: {
  label: string;
  value: string;
  /** Percent change vs the previous period, or null when there's no
   *  baseline to compare against (rendered as "—", not a misleading 0%). */
  delta: number | null;
  /** Some metrics are "good" when they go down (refund rate, CAC) — flips
   *  which direction gets the green/red treatment. */
  deltaGoodDirection?: 'up' | 'down';
  sparkline: number[];
}) {
  const isGood = delta === null ? null : deltaGoodDirection === 'up' ? delta >= 0 : delta <= 0;
  const tone = isGood === null ? 'neutral' : isGood ? 'good' : 'bad';
  const DeltaIcon = delta !== null && delta < 0 ? TrendingDown : TrendingUp;

  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase">{label}</div>
          <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">{value}</div>
          <div
            className={cn(
              'mt-1 flex items-center gap-1 text-xs font-medium',
              tone === 'good' && 'text-status-good',
              tone === 'bad' && 'text-status-critical',
              tone === 'neutral' && 'text-muted-foreground',
            )}
          >
            {delta !== null ? (
              <>
                <DeltaIcon className="size-3" />
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)}%
              </>
            ) : (
              '—'
            )}
            <span className="font-normal text-muted-foreground">vs previous period</span>
          </div>
        </div>
        <Sparkline points={sparkline} tone={tone === 'neutral' ? 'neutral' : tone} />
      </CardContent>
    </Card>
  );
}
