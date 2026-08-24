import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** KPI tile — dataviz skill's "stat tile" contract: label (sentence case, no
 *  trailing colon), value (semibold, auto-compact formatting done by the
 *  caller), optional sub-label for a secondary figure (e.g. a count beside a
 *  money value). No delta/sparkline (would need a prior-period comparison
 *  query this API doesn't expose yet — plan/19 §14 explicitly scopes that
 *  out of MVP; add it here once that data exists, not before). */
export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Compact-formats a number the way the dataviz skill's stat-tile spec calls
 *  for (1,284 / 12.9K / 4.2M) — used for unit counts, not money (money keeps
 *  full precision via formatMoney below, since a merchant reading a revenue
 *  KPI wants the exact figure, not a rounded one). */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Formats a NUMERIC(18,4) string from the API as a money figure — 2 decimal
 *  places, thousands-comma'd, no currency symbol prefixed (the analytics API
 *  can mix currencies across websites; see prisma-analytics-query.repository.ts's
 *  header comment — callers that know they're single-currency can prefix one
 *  themselves). */
export function formatMoney(value: string): string {
  const n = Number(value);
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
