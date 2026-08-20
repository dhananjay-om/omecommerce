import type { SearchIndex, SearchQuery, MediaUrlResolver } from '../domain/ports.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export interface SearchProductsQuery {
  storeViewId: string;
  q?: string;
  filters?: Record<string, string>;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchProductHit {
  productId: string;
  sku: string;
  name: string;
  priceDisplay: string | null;
  mrpDisplay: string | null;
  currency: string | null;
  imageUrl: string | null;
}

export interface SearchProductsResult {
  total: number;
  page: number;
  pageSize: number;
  hits: SearchProductHit[];
  facets: Record<string, Array<{ value: string; count: number }>>;
}

const VALID_SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'name_asc']);

export class SearchProducts {
  constructor(
    private readonly index: SearchIndex,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  async execute(query: SearchProductsQuery): Promise<SearchProductsResult> {
    if (query.sort && !VALID_SORTS.has(query.sort)) {
      throw new ValidationError('invalid sort', [{ path: 'sort', message: `must be one of ${[...VALID_SORTS].join(', ')}` }]);
    }
    const filters = Object.entries(query.filters ?? {}).map(([field, value]) => ({ field, value }));
    const searchQuery: SearchQuery = {
      storeViewId: query.storeViewId,
      q: query.q,
      filters,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      inStock: query.inStock,
      sort: (query.sort as SearchQuery['sort']) ?? 'relevance',
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    };
    const result = await this.index.search(searchQuery);

    // Presigned GET URLs expire in 15 minutes, so they're resolved fresh here
    // rather than stored in the index (see ProductMediaLookup's doc comment).
    const hits = await Promise.all(
      result.hits.map(async ({ imageKey, ...hit }) => ({
        ...hit,
        imageUrl: imageKey ? await this.mediaUrls.presignGetUrl(imageKey) : null,
      })),
    );

    return { ...result, hits };
  }
}
