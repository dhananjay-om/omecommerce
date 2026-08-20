/**
 * Product search index (plan/06). Single index with a storeViewId filter field
 * rather than one index per store view — plan/06's per-store-view aliasing is a
 * documented scale/relevance optimization, deferred until it's actually needed;
 * store views are few, and a filter clause on every query is a fine starting
 * point. Document _id = `${productId}_${storeViewId}` so re-indexing a product
 * for one store view is a plain upsert, never a duplicate.
 *
 * `facets` is a `nested` array of {code, value} pairs — the standard exact-match
 * attribute-faceting pattern (unlike `flattened`, whose aggregation semantics are
 * less standardized): a `nested` aggregation on `facets` + a `terms` agg on
 * `facets.code` then `facets.value` gives per-attribute facet counts, and query
 * filters use a `nested` filter with both `code`/`value` terms. Every filterable
 * attribute value (including numbers) is indexed as its string form — exact-value
 * faceting only. Category membership reuses this same mechanism under the
 * reserved `__category` code (plan/14 Phase 0a, see search/domain/ports.ts's
 * `CATEGORY_FACET_CODE`) rather than a dedicated field. `price` is a genuine
 * numeric field, so it supports a real `range` query (min/max) — see
 * `OpenSearchIndex.search()` — unlike the string-only facets.
 */
export const PRODUCT_INDEX = 'product_search';

export const PRODUCT_INDEX_MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    properties: {
      productId: { type: 'keyword' },
      storeViewId: { type: 'keyword' },
      sku: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      type: { type: 'keyword' },
      status: { type: 'keyword' },
      visibility: { type: 'keyword' },
      isInStock: { type: 'boolean' },
      price: { type: 'double' },
      priceDisplay: { type: 'keyword' },
      mrpDisplay: { type: 'keyword' },
      currency: { type: 'keyword' },
      imageKey: { type: 'keyword' },
      facets: {
        type: 'nested',
        properties: {
          code: { type: 'keyword' },
          value: { type: 'keyword' },
        },
      },
      updatedAt: { type: 'date' },
    },
  },
} as const;
