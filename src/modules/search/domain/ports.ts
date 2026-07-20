export interface FacetPair {
  code: string;
  value: string;
}

/** Reserved facet code for category membership (plan/14 Phase 0a) — a product can carry several of these, one per assigned category's publicId. Not a real attribute, just reuses the existing generic facet-filter mechanism. */
export const CATEGORY_FACET_CODE = '__category';

/** Reserved facet code for brand (plan/14 Phase 0b) — at most one per product (Product.brandId is a single nullable FK, unlike categories). */
export const BRAND_FACET_CODE = '__brand';

export interface ProductDocument {
  productId: string;
  storeViewId: string;
  sku: string;
  name: string;
  type: string;
  status: string;
  visibility: string;
  isInStock: boolean;
  price: number | null;
  priceDisplay: string | null;
  currency: string | null;
  facets: FacetPair[];
  updatedAt: string;
}

export interface SearchFilter {
  field: string;
  value: string;
}

export interface SearchQuery {
  storeViewId: string;
  q?: string;
  filters: SearchFilter[];
  /** Inclusive numeric range on the top-level `price` field — not a facet, since price isn't a discrete filterable attribute. */
  priceMin?: number;
  priceMax?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'name_asc';
  page: number;
  pageSize: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchResult {
  total: number;
  page: number;
  pageSize: number;
  hits: Array<{ productId: string; sku: string; name: string; priceDisplay: string | null; currency: string | null }>;
  facets: Record<string, FacetBucket[]>;
}

/**
 * The search index port (plan/06). OpenSearch is the implementation; this is
 * engine-agnostic (an Elasticsearch adapter would implement the same port).
 */
export interface SearchIndex {
  ensureIndex(): Promise<void>;
  upsert(doc: ProductDocument): Promise<void>;
  deleteByProductId(productId: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
}
