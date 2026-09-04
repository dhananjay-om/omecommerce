/**
 * Channel-agnostic port every source-platform connector implements —
 * Shopify ships first (infrastructure/shopify-client.ts); Magento is a
 * second implementation of this same port, not a rewrite of the engine
 * (analyze-catalog.usecase.ts / catalog-migration.worker.ts never know
 * which channel they're talking to).
 */
export interface SourceCatalogClient {
  /** Cheap real proof-of-life call (e.g. Shopify's GET /shop.json) — never
   *  swallowed into a silent failure, same "re-throw the real provider
   *  error" posture as TestAiConnection/SendTestEmail. */
  testConnection(): Promise<{ ok: true; storeName?: string } | { ok: false; message: string }>;
  countProducts(): Promise<number>;
  /** A small, bounded sample (NOT the whole catalog) — just enough for
   *  AnalyzeCatalog to see every distinct option name/product type without
   *  pulling potentially thousands of products into one request. */
  sampleProducts(limit: number): Promise<SourceProduct[]>;
  /** Full, paginated read — used by the actual migration run, never by
   *  Analyze. `cursor` is opaque to the caller (Shopify: a page_info
   *  token; Magento: a page number) — round-trip it back verbatim. */
  listProducts(cursor: string | null): Promise<{ products: SourceProduct[]; nextCursor: string | null }>;
  listCategories(): Promise<SourceCategory[]>;
}

export interface SourceProductVariant {
  externalId: string;
  sku: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  /** Positional — index i matches SourceProduct.options[i] (Shopify's own
   *  option1/option2/option3 convention, generalized). */
  optionValues: string[];
}

export interface SourceProductOption {
  name: string;
  values: string[];
}

export interface SourceProductImage {
  url: string;
  position: number;
}

export interface SourceProduct {
  externalId: string;
  /** The product's OWN sku when it has no real variants (Shopify still
   *  gives every product exactly one variant even for a "simple" product —
   *  see shopify-client.ts's own doc comment on how SIMPLE vs CONFIGURABLE
   *  is decided from that). */
  sku: string | null;
  title: string;
  bodyHtml: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  variants: SourceProductVariant[];
  options: SourceProductOption[];
  images: SourceProductImage[];
  categoryExternalIds: string[];
}

export interface SourceCategory {
  externalId: string;
  name: string;
  parentExternalId: string | null;
}
