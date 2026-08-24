/** Shared "YYYY-MM-DD" date-range helpers for every /reports/* page — the
 *  analytics API requires both dateFrom and dateTo on every call (see
 *  lib/types.ts's header comment), so every page needs a resolved default
 *  even when the URL carries neither. */

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ResolvedDateRange {
  dateFrom: string;
  dateTo: string;
}

/** Defaults to the last 30 days (inclusive of today) when the URL doesn't
 *  specify a range — a reasonable "recent activity" window for a first
 *  view of any report. */
export function resolveDateRange(params: { dateFrom?: string; dateTo?: string }): ResolvedDateRange {
  if (params.dateFrom && params.dateTo) return { dateFrom: params.dateFrom, dateTo: params.dateTo };
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  return { dateFrom: toDateOnly(thirtyDaysAgo), dateTo: toDateOnly(today) };
}

export interface DateRangePreset {
  label: string;
  dateFrom: string;
  dateTo: string;
}

/** The dataviz skill's own filter-control spec: "today, last 7/30/90 days,
 *  month-to-date" preset rows. */
export function dateRangePresets(): DateRangePreset[] {
  const today = new Date();
  const dateTo = toDateOnly(today);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toDateOnly(d);
  };
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return [
    { label: 'Today', dateFrom: dateTo, dateTo },
    { label: 'Last 7 days', dateFrom: daysAgo(6), dateTo },
    { label: 'Last 30 days', dateFrom: daysAgo(29), dateTo },
    { label: 'Last 90 days', dateFrom: daysAgo(89), dateTo },
    { label: 'Month to date', dateFrom: toDateOnly(monthStart), dateTo },
  ];
}
