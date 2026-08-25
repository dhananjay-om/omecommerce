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
  /** The product's own publicId (UUID) — what /products/:id routes
   *  actually key by (confirmed against every product list page's own
   *  `router.push('/products/${p.publicId}')` convention). `productId`
   *  above is the internal bigint id, never valid in a URL — a real bug
   *  found and fixed while building Recommendations: the frontend was
   *  linking with `productId`, which 404s. */
  productPublicId: string | null;
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

/** Suggestion read port — same read/write split as the others above.
 *  `actionHref` (built from the target's own publicId at write time, same
 *  "get the publicId right, not the internal id" fix applied to
 *  ProductForecast above) points straight at the suggested ACTION's own
 *  page (e.g. .../inventory or .../pricing), not just the entity's
 *  overview — same convention as AiInsight.actionHref. */
export interface MerchandisingSuggestionFilter {
  kind?: string;
  confidence?: string;
  websiteId?: bigint;
  page: number;
  pageSize: number;
}

export interface MerchandisingSuggestionRow {
  publicId: string;
  dateKey: number;
  kind: string;
  targetType: string;
  targetName: string | null;
  headline: string;
  rationale: string;
  impactScore: string;
  confidence: string;
  actionLabel: string;
  actionHref: string;
}

export interface MerchandisingSuggestionListResult {
  total: number;
  page: number;
  pageSize: number;
  suggestions: MerchandisingSuggestionRow[];
}

export interface MerchandisingSuggestionQueryRepository {
  list(filter: MerchandisingSuggestionFilter): Promise<MerchandisingSuggestionListResult>;
}
