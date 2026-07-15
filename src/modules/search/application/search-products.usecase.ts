import type { SearchIndex, SearchQuery, SearchResult } from '../domain/ports.js';
import { ValidationError } from '../../../shared/domain/errors.js';

export interface SearchProductsQuery {
  storeViewId: string;
  q?: string;
  filters?: Record<string, string>;
  sort?: string;
  page?: number;
  pageSize?: number;
}

const VALID_SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'name_asc']);

export class SearchProducts {
  constructor(private readonly index: SearchIndex) {}

  async execute(query: SearchProductsQuery): Promise<SearchResult> {
    if (query.sort && !VALID_SORTS.has(query.sort)) {
      throw new ValidationError('invalid sort', [{ path: 'sort', message: `must be one of ${[...VALID_SORTS].join(', ')}` }]);
    }
    const filters = Object.entries(query.filters ?? {}).map(([field, value]) => ({ field, value }));
    const searchQuery: SearchQuery = {
      storeViewId: query.storeViewId,
      q: query.q,
      filters,
      sort: (query.sort as SearchQuery['sort']) ?? 'relevance',
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    };
    return this.index.search(searchQuery);
  }
}
