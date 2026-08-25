import type { ProductForecastQueryRepository, ProductForecastListResult } from '../domain/queries.js';
import type { ListForecastsQuery } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;

/** Thin — mirrors list-insights.usecase.ts's ListInsights exactly. */
export class ListForecasts {
  constructor(private readonly forecasts: ProductForecastQueryRepository) {}

  execute(q: ListForecastsQuery): Promise<ProductForecastListResult> {
    return this.forecasts.list({
      riskTier: q.riskTier,
      websiteId: q.websiteId !== undefined ? BigInt(q.websiteId) : undefined,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
    });
  }
}
