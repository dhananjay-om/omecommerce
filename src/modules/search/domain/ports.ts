export interface FacetPair {
  code: string;
  value: string;
}

/** Reserved facet code for category membership (plan/14 Phase 0a) — a product carries one of these per DIRECTLY assigned category's publicId AND every one of that category's ancestors (plan/14 Phase 3a: browsing "Electronics" must also surface a product only assigned to "Laptops"), via CategoryMembershipLookup. Not a real attribute, just reuses the existing generic facet-filter mechanism. */
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
  /** Storage key of the lowest-position media asset, not a URL — see ProductMediaLookup's doc comment. */
  imageKey: string | null;
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
  /** Exact match on the top-level `isInStock` field — same reasoning as price: a real boolean field, not a discrete facet value. */
  inStock?: boolean;
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
  hits: Array<{ productId: string; sku: string; name: string; priceDisplay: string | null; currency: string | null; imageKey: string | null }>;
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
  /**
   * Every distinct productId currently indexed, across all store views
   * (plan/14 — lets ReindexAll diff against Postgres and delete only true
   * orphans, e.g. a product removed outside the normal flow like a test's
   * raw TRUNCATE, which bypasses IndexProduct's delete-on-missing-product
   * path). Deliberately NOT a "clear everything then rebuild": emptying the
   * index and repopulating it is a window where concurrent searches see
   * nothing (or, with a dropped index, an outright 500) — surgical diff-and-
   * delete never has that window.
   */
  listAllProductIds(): Promise<string[]>;
  search(query: SearchQuery): Promise<SearchResult>;
}

/** Resolves a stored media key to a fresh, short-lived GET URL (plan/14 Phase 2a) — a narrower port than catalog's `MediaStorage` since search only ever reads. */
export interface MediaUrlResolver {
  presignGetUrl(key: string): Promise<string>;
}
