import type { AiInsightRepository } from '../domain/repositories.js';

export interface RefreshWebsiteInsightsCommand {
  dateKey: number;
  websiteId: bigint;
}

/** The single code path for regenerating one (dateKey, websiteId) bucket's
 *  insights — mirrors analytics/application/refresh-website-day.usecase.ts's
 *  RefreshWebsiteDay exactly (same shape, same one-method-repository
 *  delegation), so the nightly refresh worker (currently the only caller —
 *  see this plan's note on why Phase 1 skips an event-driven projector: a
 *  trailing-7-day-trend insight doesn't need real-time updates the way
 *  "today's order count" does) has one thing to call. */
export class RefreshWebsiteInsights {
  constructor(private readonly insights: AiInsightRepository) {}

  async execute(cmd: RefreshWebsiteInsightsCommand): Promise<void> {
    await this.insights.refreshInsights(cmd.dateKey, cmd.websiteId);
  }
}
