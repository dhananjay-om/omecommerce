/**
 * This module's day-bucketing convention: an integer YYYYMMDD, always in
 * UTC. UTC (not per-website local time) because nothing else in this schema
 * carries a timezone to bucket by — Website/OrderAddress have none (see
 * infrastructure/prisma-analytics.repository.ts's header comment).
 */

/** Any instant's UTC calendar day, as YYYYMMDD — the projector worker uses
 *  this on both an event's processing time ("today") and an order's own
 *  `placedAt` (which can be an earlier day than the event that just fired,
 *  e.g. a refund issued days after placement). */
export function dateKeyOf(date: Date): number {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return Number(`${year}${month}${day}`);
}

/** The current instant's UTC calendar day, as YYYYMMDD. */
export function todayDateKey(now: Date): number {
  return dateKeyOf(now);
}

/** The UTC calendar day immediately before the given instant, as YYYYMMDD —
 *  what the nightly refresh worker targets (plan/19 §11: runs after
 *  midnight UTC, recomputing the day that just closed). */
export function yesterdayDateKey(now: Date): number {
  const y = new Date(now.getTime());
  y.setUTCDate(y.getUTCDate() - 1);
  return dateKeyOf(y);
}

/** Parses a "YYYY-MM-DD" query-param string (same convention as order/
 *  interface/http/schemas.ts's dateFrom/dateTo) into a dateKey int. */
export function parseDateKey(dateStr: string): number {
  return Number(dateStr.replaceAll('-', ''));
}

/** Inverse of the above — the [start, end) UTC instant range a dateKey
 *  represents. Shared by the repository (bucket boundaries for its
 *  aggregation queries) so there's exactly one place this arithmetic lives. */
export function dateKeyToRange(dateKey: number): { start: Date; end: Date } {
  const s = String(dateKey);
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6)) - 1;
  const day = Number(s.slice(6, 8));
  const start = new Date(Date.UTC(year, month, day));
  const end = new Date(Date.UTC(year, month, day + 1));
  return { start, end };
}
