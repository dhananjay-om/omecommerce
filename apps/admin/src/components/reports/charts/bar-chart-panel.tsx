'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resolveChartFormatter, type ChartValueFormat } from './format';

/**
 * Shared single-series bar chart — rankings (top products/categories) and
 * discrete-category breakdowns (order status counts, RFM segments) both
 * read as "compare magnitude across known labels," which the dataviz
 * skill's form guide maps to a bar/column chart in ONE sequential hue
 * (`--chart-1`), not a categorical palette per bar — the labels on the axis
 * already carry identity, so per-bar color would just be decoration, and a
 * fixed 5-slot chart palette can't cover 7+ order statuses anyway. Mark
 * specs: bars ≤24px thick, 4px rounded data-end, square at the baseline.
 */
export function BarChartPanel({
  data,
  orientation = 'columns',
  height = 280,
  format: formatKind = 'plain',
}: {
  data: Array<{ label: string; value: number }>;
  /** "columns" = vertical bars, category on the x-axis (rankings, status
   *  counts). "bars" = horizontal bars, category on the y-axis (long
   *  category names that would collide as x-axis ticks). */
  orientation?: 'columns' | 'bars';
  height?: number;
  format?: ChartValueFormat;
}) {
  const format = resolveChartFormatter(formatKind);
  const isColumns = orientation === 'columns';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isColumns ? 'horizontal' : 'vertical'}
        margin={{ top: 8, right: 16, left: isColumns ? 0 : 8, bottom: 0 }}
        barCategoryGap={8}
      >
        <CartesianGrid stroke="var(--border)" strokeWidth={1} horizontal={isColumns} vertical={!isColumns} />
        {isColumns ? (
          <>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => format(Number(v))} width={56} />
          </>
        ) : (
          <>
            <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => format(Number(v))} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              width={140}
            />
          </>
        )}
        <Tooltip
          formatter={(value) => [format(Number(value)), 'Value'] as [string, string]}
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
        />
        <Bar dataKey="value" fill="var(--chart-1)" radius={isColumns ? [4, 4, 0, 0] : [0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
