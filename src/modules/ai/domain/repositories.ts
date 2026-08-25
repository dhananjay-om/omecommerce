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

/** Admin-configurable LLM provider credentials — a true singleton, same
 *  shape/reasoning as order/domain/repositories.ts's EmailSettingsRepository
 *  (deliberately mirrored, see ai.prisma's AiSettings model doc comment).
 *  `get()` returns the raw record (including the plaintext key) for
 *  internal use (getOpenAiClient); the HTTP-facing GetAiSettings use case is
 *  what's responsible for never leaking `apiKey` out of that record. */
export interface AiSettingsRecord {
  id: bigint;
  publicId: string;
  provider: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface UpsertAiSettingsInput {
  provider: string;
  /** Omitted keeps the currently-saved key unchanged — same contract as
   *  EmailSettingsRepository.upsert's `password`. */
  apiKey?: string;
  model: string;
  isActive: boolean;
  createdBy: bigint | null;
  updatedBy: bigint | null;
}

export interface AiSettingsRepository {
  get(): Promise<AiSettingsRecord | null>;
  upsert(input: UpsertAiSettingsInput): Promise<AiSettingsRecord>;
}
