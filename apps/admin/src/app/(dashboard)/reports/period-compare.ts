import type { ResolvedDateRange } from './date-range';

/** The immediately-preceding period of the same length as `range` — e.g.
 *  range = last 30 days -> this returns the 30 days before that. Used for
 *  "vs previous period" KPI deltas (Dashboard's "Command Center" KPI row). */
export function previousPeriod(range: ResolvedDateRange): ResolvedDateRange {
  const from = new Date(range.dateFrom);
  const to = new Date(range.dateTo);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { dateFrom: toDateOnly(prevFrom), dateTo: toDateOnly(prevTo) };
}

/** Percent change from `previous` to `current` — null when there's no
 *  previous-period baseline to compare against (division by zero isn't a
 *  meaningful "0% change" or "infinite % change", it's "no comparison
 *  available"), so callers can render "—" instead of a misleading number. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
