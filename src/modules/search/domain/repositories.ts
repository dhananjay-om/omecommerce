export interface ProductCoreInfo {
  id: bigint;
  publicId: string;
  sku: string;
  name: string | null;
  type: string;
  status: string;
  visibility: string;
  attributeSetId: bigint;
}

/** Read-only lookup — Search owns its own copy per the established per-module pattern. */
export interface ProductLookup {
  byPublicId(publicId: string): Promise<ProductCoreInfo | null>;
  /** All non-deleted, active products — used by the full-reindex job. */
  allActive(): Promise<ProductCoreInfo[]>;
  /**
   * Attribute/price resolution keys off a VARIANT, not a product (plan/01/plan/07).
   * For SIMPLE/DIGITAL/VIRTUAL this is the implicit variant created alongside the
   * product (Stage 1/2) — unambiguous. For CONFIGURABLE/BUNDLE with multiple
   * variants, a single representative price/attribute set is genuinely ambiguous
   * (price range, cheapest-variant, etc.) — deferred; this returns the first
   * variant by id as a documented heuristic, and callers treat a null price as
   * "not indexable with a single price" rather than failing indexing entirely.
   */
  firstVariantId(productId: bigint): Promise<bigint | null>;
}

export interface StoreViewInfo {
  id: bigint;
  websiteId: bigint;
  storeId: bigint;
  currency: string;
}

export interface StoreViewLookup {
  allActive(): Promise<StoreViewInfo[]>;
}

/** Which attributes should be searched/faceted — driven by the attribute's own flags. */
export interface FacetableAttribute {
  id: bigint;
  code: string;
}

export interface AttributeFlagsLookup {
  facetable(): Promise<FacetableAttribute[]>;
}

/** Simple in-stock check (a display flag, not a money/ledger concern — no guarded
 * UPDATE machinery needed for a read-only projection). */
export interface StockAvailabilityLookup {
  isInStock(productId: bigint): Promise<boolean>;
}

/** Category assignment, projected into the index as a reserved facet (plan/14 Phase 0a) — lets `GET /store/v1/search?filter[__category]=<publicId>` power the PLP without a dedicated category-scoped endpoint. */
export interface CategoryMembershipLookup {
  categoryPublicIds(productId: bigint): Promise<string[]>;
}

/** Brand assignment, projected into the index as a reserved facet (plan/14 Phase 0b) — same mechanism as category, but at most one value per product. */
export interface BrandLookup {
  brandPublicId(productId: bigint): Promise<string | null>;
}
