import { formatMoney } from '@/components/reports/stat-card';

/** "Revenue by X" mini bar-list — label, a proportional filled bar, the
 *  value, and its share of the total. Matches the mock's `barList()`
 *  pattern exactly. A plain labeled bar list, not a Recharts bar chart —
 *  the dataviz skill treats "rank a handful of named categories, show
 *  share of whole" as a bar-list, not an axis-bearing chart, once labels
 *  are long/prose-like (product/category/segment names) rather than short
 *  axis ticks. */
export function RevenueBarList({ rows, total }: { rows: Array<{ label: string; value: number }>; total: number }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data in this range.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const share = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{r.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                {formatMoney(r.value.toString())} <span className="text-xs">({share.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
