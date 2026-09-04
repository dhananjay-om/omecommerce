import type { Client } from '@opensearch-project/opensearch';
import { PRODUCT_INDEX, PRODUCT_INDEX_MAPPING } from '../../../shared/infrastructure/search/index-mapping.js';
import type { SearchIndex, ProductDocument, SearchQuery, SearchResult, FacetBucket } from '../domain/ports.js';

const FACET_SIZE = 50;
/** Dev/demo scale — plenty for a single-index catalog at this project's current size; a real per-store-view-index architecture (index-mapping.ts's documented future scale path) would replace this aggregation entirely. */
const MAX_PRODUCT_IDS = 10_000;

export class OpenSearchIndex implements SearchIndex {
  constructor(private readonly client: Client) {}

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: PRODUCT_INDEX });
    if (!exists.body) {
      await this.client.indices.create({ index: PRODUCT_INDEX, body: PRODUCT_INDEX_MAPPING });
    }
  }

  async upsert(doc: ProductDocument): Promise<void> {
    await this.client.index({
      index: PRODUCT_INDEX,
      id: `${doc.productId}_${doc.storeViewId}`,
      body: doc,
      refresh: true, // dev/demo scale: make writes immediately searchable, matching plan/06's NRT goal
    });
  }

  async deleteByProductId(productId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: PRODUCT_INDEX,
      body: { query: { term: { productId } } },
      refresh: true,
    });
  }

  async listAllProductIds(): Promise<string[]> {
    const exists = await this.client.indices.exists({ index: PRODUCT_INDEX });
    if (!exists.body) return [];
    const response = await this.client.search({
      index: PRODUCT_INDEX,
      body: {
        size: 0,
        aggs: { ids: { terms: { field: 'productId', size: MAX_PRODUCT_IDS } } },
      },
    });
    const body = response.body as { aggregations?: { ids: { buckets: Array<{ key: string }> } } };
    return (body.aggregations?.ids.buckets ?? []).map((b) => b.key);
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const filter: object[] = [
      { term: { storeViewId: query.storeViewId } },
      { term: { status: 'ACTIVE' } },
      { terms: { visibility: ['BOTH', 'SEARCH'] } },
    ];
    for (const f of query.filters) {
      filter.push({
        nested: {
          path: 'facets',
          query: { bool: { filter: [{ term: { 'facets.code': f.field } }, { term: { 'facets.value': f.value } }] } },
        },
      });
    }
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      filter.push({
        range: {
          price: {
            ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
            ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
          },
        },
      });
    }
    if (query.inStock !== undefined) {
      filter.push({ term: { isInStock: query.inStock } });
    }

    const must = query.q ? [{ multi_match: { query: query.q, fields: ['name^3', 'sku^2'] } }] : [{ match_all: {} }];

    const sort = sortClause(query.sort);

    const response = await this.client.search({
      index: PRODUCT_INDEX,
      body: {
        query: { bool: { must, filter } },
        from: (query.page - 1) * query.pageSize,
        size: query.pageSize,
        sort,
        aggs: {
          facets: {
            nested: { path: 'facets' },
            aggs: {
              by_code: {
                terms: { field: 'facets.code', size: FACET_SIZE },
                aggs: {
                  by_value: {
                    terms: { field: 'facets.value', size: FACET_SIZE },
                    // A value's swatch is always the same option's (per FacetPair's
                    // doc comment) — size 1 just reads it back, not a real aggregation.
                    aggs: { swatch: { terms: { field: 'facets.swatch', size: 1 } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const body = response.body as OpenSearchResponse;
    const hits = body.hits.hits.map((h) => ({
      productId: h._source.productId,
      sku: h._source.sku,
      slug: h._source.slug,
      name: h._source.name,
      priceDisplay: h._source.priceDisplay,
      mrpDisplay: h._source.mrpDisplay,
      currency: h._source.currency,
      imageKey: h._source.imageKey,
    }));

    const facets: Record<string, FacetBucket[]> = {};
    for (const codeBucket of body.aggregations?.facets.by_code.buckets ?? []) {
      facets[codeBucket.key] = codeBucket.by_value.buckets.map((v) => {
        const swatch = v.swatch.buckets[0]?.key;
        return { value: v.key, count: v.doc_count, ...(swatch ? { swatch } : {}) };
      });
    }

    return {
      total: typeof body.hits.total === 'number' ? body.hits.total : body.hits.total.value,
      page: query.page,
      pageSize: query.pageSize,
      hits,
      facets,
    };
  }
}

function sortClause(sort: SearchQuery['sort']): Array<string | object> {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }];
    case 'name_asc':
      return [{ 'name.keyword': 'asc' }];
    default:
      return ['_score'];
  }
}

interface OpenSearchResponse {
  hits: {
    total: number | { value: number };
    hits: Array<{ _source: ProductDocument }>;
  };
  aggregations?: {
    facets: {
      by_code: {
        buckets: Array<{
          key: string;
          by_value: {
            buckets: Array<{ key: string; doc_count: number; swatch: { buckets: Array<{ key: string }> } }>;
          };
        }>;
      };
    };
  };
}
