import type { AiInsightRepository } from '../domain/repositories.js';
import { RefreshWebsiteSuggestions } from './refresh-website-suggestions.usecase.js';

/** Mirrors run-nightly-forecast-refresh.usecase.ts's
 *  RunNightlyForecastRefresh exactly — loops every configured website
 *  (AiInsightRepository.listWebsiteIds(), reused directly, same as
 *  Forecasting) through the same refresh path a single-website call would
 *  use. Must run AFTER forecast refresh in the same nightly pass — 2 of
 *  the 3 suggestion kinds read ProductForecast's own freshly-computed
 *  output (see ai-refresh.worker.ts's own ordering). */
export class RunNightlySuggestionRefresh {
  constructor(
    private readonly insights: AiInsightRepository,
    private readonly refreshWebsiteSuggestions: RefreshWebsiteSuggestions,
  ) {}

  async execute(dateKey: number): Promise<void> {
    const websiteIds = await this.insights.listWebsiteIds();
    for (const websiteId of websiteIds) {
      await this.refreshWebsiteSuggestions.execute({ dateKey, websiteId });
    }
  }
}
