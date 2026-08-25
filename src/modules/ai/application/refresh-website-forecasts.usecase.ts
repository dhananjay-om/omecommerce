import type { ProductForecastRepository } from '../domain/repositories.js';

export interface RefreshWebsiteForecastsCommand {
  dateKey: number;
  websiteId: bigint;
}

/** Mirrors refresh-website-insights.usecase.ts's RefreshWebsiteInsights
 *  exactly — the single code path for regenerating one (dateKey,
 *  websiteId) bucket's forecasts. */
export class RefreshWebsiteForecasts {
  constructor(private readonly forecasts: ProductForecastRepository) {}

  async execute(cmd: RefreshWebsiteForecastsCommand): Promise<void> {
    await this.forecasts.refreshForecasts(cmd.dateKey, cmd.websiteId);
  }
}
