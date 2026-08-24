'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resolveChartFormatter, type ChartValueFormat } from './format';

export interface TrendSeries {
  key: string;
  label: string;
  /** One of the 5 shared chart tokens, e.g. "var(--chart-1)" — see
   *  globals.css. Keep series order stable across renders (color follows
   *  the entity, never its rank — dataviz skill). */
  colorVar: string;
}

/**
 * Shared trend-line chart for every /reports/* page — dataviz skill mark
 * specs: 2px lines, ≥8px markers (r=4 → 8px diameter), hairline solid
 * gridlines, a legend only when there's more than one series (a single
 * series needs no legend box — the chart title already names it), tooltip
 * on hover. Capped at 3 series by convention (this app's dashboards never
 * need more — see plan/19 §6); a 4th would need direct labels per the
 * skill's series-count ladder, which this component doesn't implement.
 */
export function TrendLineChart({
  data,
  series,
  xKey = 'x',
  height = 280,
  format: formatKind = 'plain',
}: {
  data: Array<Record<string, string | number>>;
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  format?: ChartValueFormat;
}) {
  const format = resolveChartFormatter(formatKind);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => format(Number(v))}
          width={56}
        />
        <Tooltip
          formatter={(value, name) => [format(Number(value)), name] as [string, string]}
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
        />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.colorVar} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
