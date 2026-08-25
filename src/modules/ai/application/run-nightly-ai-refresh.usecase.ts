import type { AiInsightRepository } from '../domain/repositories.js';
import { RefreshWebsiteInsights } from './refresh-website-insights.usecase.js';

/** The nightly batch orchestration — mirrors
 *  analytics/application/run-nightly-refresh.usecase.ts's RunNightlyRefresh
 *  shape: loop every website through the same refresh path a single-website
 *  call would use. Unlike RunNightlyRefresh, this loops EVERY configured
 *  website (AiInsightRepository.listWebsiteIds), not just ones with order
 *  activity that day — see that method's own doc comment. */
export class RunNightlyAiRefresh {
  constructor(
    private readonly insights: AiInsightRepository,
    private readonly refreshWebsiteInsights: RefreshWebsiteInsights,
  ) {}

  async execute(dateKey: number): Promise<void> {
    const websiteIds = await this.insights.listWebsiteIds();
    for (const websiteId of websiteIds) {
      await this.refreshWebsiteInsights.execute({ dateKey, websiteId });
    }
  }
}
