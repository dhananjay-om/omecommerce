/**
 * The AI Insights read port — plain queries over the already-materialized
 * `ai_insight` table (cheap, no business logic), separate from
 * `AiInsightRepository` (the write/refresh port in repositories.ts, where
 * the actual rule engine lives) — same read/write split and reasoning as
 * analytics/domain/queries.ts's own header comment.
 */

export interface AiInsightFilter {
  category?: string;
  impact?: string;
  fromDateKey?: number;
  toDateKey?: number;
  websiteId?: bigint;
  page: number;
  pageSize: number;
}

export interface AiInsightRow {
  publicId: string;
  dateKey: number;
  category: string;
  impact: string;
  headline: string;
  actionLabel: string;
  actionHref: string;
  createdAt: Date;
}

export interface AiInsightListResult {
  total: number;
  page: number;
  pageSize: number;
  insights: AiInsightRow[];
}

export interface AiInsightQueryRepository {
  list(filter: AiInsightFilter): Promise<AiInsightListResult>;
}

/** Forecast read port — same read/write split as AiInsightQueryRepository
 *  above. Rows are joined against `product` for display (name/sku) — the
 *  write side only stores `productId`, same convention as
 *  AnalyticsQueryRepository.getTopProducts. */
export interface ProductForecastFilter {
  riskTier?: string;
  websiteId?: bigint;
  page: number;
  pageSize: number;
}

export interface ProductForecastRow {
  publicId: string;
  dateKey: number;
  productId: string;
  productName: string | null;
  sku: string | null;
  avgDailySellRate: string;
  trendPct: string | null;
  currentStock: number;
  daysOfCover: string | null;
  riskTier: string;
}

export interface ProductForecastListResult {
  total: number;
  page: number;
  pageSize: number;
  forecasts: ProductForecastRow[];
}

export interface ProductForecastQueryRepository {
  list(filter: ProductForecastFilter): Promise<ProductForecastListResult>;
}
