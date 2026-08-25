/**
 * The AI Insights write/refresh port — one idempotent method, same
 * "full re-aggregation of a bucket, not a delta-apply" contract as
 * analytics/domain/repositories.ts's AnalyticsRepository (see that
 * interface's own doc comment): safe to re-run for the same
 * (dateKey, websiteId) any number of times, always converges to the same
 * result. Shared by RefreshWebsiteInsights, which is itself shared by
 * whatever calls it on a schedule — see analytics' own RefreshWebsiteDay
 * for the precedent this mirrors.
 */
export interface AiInsightRepository {
  refreshInsights(dateKey: number, websiteId: bigint): Promise<void>;
  /** Every configured website, not just ones with recent order activity
   *  (unlike AnalyticsRepository.listActiveWebsiteIds) — a website with zero
   *  activity this week just won't have any rule fire, which is a correct,
   *  harmless outcome, and keeping this independent of the analytics module
   *  avoids a cross-module dependency for one id list. */
  listWebsiteIds(): Promise<bigint[]>;
}
