'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resolveChartFormatter } from '@/components/reports/charts/format';
import { cn } from '@/lib/utils';

export interface SalesAnalyticsPoint {
  x: string;
  thisRevenue: number;
  prevRevenue: number;
  thisOrders: number;
  prevOrders: number;
  thisUnits: number;
  prevUnits: number;
  thisAov: number;
  prevAov: number;
}

const METRICS = [
  { key: 'Revenue', thisKey: 'thisRevenue', prevKey: 'prevRevenue', format: 'compact' as const },
  { key: 'Orders', thisKey: 'thisOrders', prevKey: 'prevOrders', format: 'plain' as const },
  { key: 'Units Sold', thisKey: 'thisUnits', prevKey: 'prevUnits', format: 'plain' as const },
  { key: 'AOV', thisKey: 'thisAov', prevKey: 'prevAov', format: 'compact' as const },
];

/**
 * "This period" vs "previous period" overlay with a metric toggle —
 * matches the mock's Sales Analytics card. Deliberately its own component
 * rather than a reuse of the shared `TrendLineChart`: that one is keyed by
 * calendar date and plots however many series share one date axis, but
 * this needs 2 *different* date ranges aligned onto one shared "day
 * offset" axis (day 1 of this period next to day 1 of the previous one) —
 * a different enough data shape that forcing it through the existing
 * component would need more contortion than just building this.
 *
 * Only 4 metrics toggle here (Revenue/Orders/Units Sold/AOV) — the mock
 * also offers Gross Profit and Margin, which need cost-of-goods data this
 * system doesn't track, so they're not included rather than faked.
 */
export function SalesAnalyticsChart({ data }: { data: SalesAnalyticsPoint[] }) {
  const [metric, setMetric] = useState(METRICS[0].key);
  const active = METRICS.find((m) => m.key === metric)!;
  const format = resolveChartFormatter(active.format);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
              metric === m.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {m.key}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboard-this-period-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="x" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => format(Number(v))} width={56} />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), name] as [string, string]}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey={active.prevKey} name="Previous period" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="transparent" />
          <Area type="monotone" dataKey={active.thisKey} name="This period" stroke="var(--chart-1)" strokeWidth={2} fill="url(#dashboard-this-period-fill)" />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} />
          This period
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground" />
          Previous period
        </span>
      </div>
    </div>
  );
}
