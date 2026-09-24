import type { SearchIndex, SearchQuery, MediaUrlResolver } from '../domain/ports.js';
import type { ProductMediaLookup } from '../domain/repositories.js';
import { logger } from '../../../shared/infrastructure/logger.js';
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
  /** Storefront canonical URL is /{slug}.html — see Product.slug's schema doc comment. */
  slug: string;
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
  facets: Record<string, Array<{ value: string; count: number; swatch?: string }>>;
}

const VALID_SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'name_asc']);

export class SearchProducts {
  constructor(
    private readonly index: SearchIndex,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly productMedia: ProductMediaLookup,
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

    // The card image is read LIVE from the database, not trusted from the index: the
    // index copy only changes when a background job re-indexes the product, so a change
    // of main image (or an added/removed photo) could show the old picture on the home
    // page and listings for as long as that refresh was late or had failed. Falls back
    // to the indexed key only if the live lookup itself errors.
    let liveImageKeys: Map<string, string> | null = null;
    try {
      liveImageKeys = await this.productMedia.primaryImageKeysByPublicId(result.hits.map((h) => h.productId));
    } catch (err) {
      logger.warn({ err }, 'live product image lookup failed; using indexed image keys');
    }

    // Presigned GET URLs expire in 15 minutes, so they're resolved fresh here
    // rather than stored in the index (see ProductMediaLookup's doc comment).
    const hits = await Promise.all(
      result.hits.map(async ({ imageKey, ...hit }) => {
        const key = liveImageKeys ? (liveImageKeys.get(hit.productId) ?? null) : imageKey;
        return { ...hit, imageUrl: key ? await this.mediaUrls.presignGetUrl(key) : null };
      }),
    );

    return { ...result, hits };
  }
}
