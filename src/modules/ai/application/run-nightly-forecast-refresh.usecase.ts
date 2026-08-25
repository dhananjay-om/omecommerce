import type { AiInsightRepository } from '../domain/repositories.js';
import { RefreshWebsiteForecasts } from './refresh-website-forecasts.usecase.js';

/** Mirrors run-nightly-ai-refresh.usecase.ts's RunNightlyAiRefresh exactly
 *  — loops every configured website (AiInsightRepository.listWebsiteIds(),
 *  reused directly rather than duplicating that method on
 *  ProductForecastRepository too) through the same refresh path a
 *  single-website call would use. */
export class RunNightlyForecastRefresh {
  constructor(
    private readonly insights: AiInsightRepository,
    private readonly refreshWebsiteForecasts: RefreshWebsiteForecasts,
  ) {}

  async execute(dateKey: number): Promise<void> {
    const websiteIds = await this.insights.listWebsiteIds();
    for (const websiteId of websiteIds) {
      await this.refreshWebsiteForecasts.execute({ dateKey, websiteId });
    }
  }
}
