import type { AnalyticsRepository } from '../domain/repositories.js';

export interface RefreshWebsiteDayCommand {
  dateKey: number;
  websiteId: bigint;
}

/** Recomputes one (dateKey, websiteId) bucket's order-derived summaries in
 *  full — the single code path shared by the event-driven projector (today's
 *  bucket, on any relevant event) and the nightly refresh worker (yesterday's
 *  bucket + catch-up). See domain/repositories.ts's header comment for why
 *  this is a full re-aggregation, not a delta apply. */
export class RefreshWebsiteDay {
  constructor(private readonly analytics: AnalyticsRepository) {}

  async execute(cmd: RefreshWebsiteDayCommand): Promise<void> {
    await this.analytics.refreshOrderSummaries(cmd.dateKey, cmd.websiteId);
    await this.analytics.refreshFulfillmentSummary(cmd.dateKey, cmd.websiteId);
  }
}
