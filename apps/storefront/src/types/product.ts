export interface ProductMedia {
  productMediaId: string;
  url: string;
  role: string;
  position: number;
  altText: string | null;
}

export interface ProductVariant {
  publicId: string;
  sku: string;
  status: string;
  position: number;
  price: string | null;
  inStock: boolean;
}

export interface ProductDetail {
  publicId: string;
  sku: string;
  type: string;
  status: string;
  visibility: string;
  name: string | null;
  weight: string | null;
  storeViewId: string;
  currency: string;
  attributes: Record<string, unknown>;
  price: string | null;
  inStock: boolean;
  media: ProductMedia[];
  variants: ProductVariant[];
  categoryIds: string[];
  brandSlug: string | null;
}

export interface SearchHit {
  productId: string;
  sku: string;
  name: string;
  priceDisplay: string | null;
  currency: string | null;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchResult {
  total: number;
  page: number;
  pageSize: number;
  hits: SearchHit[];
  facets: Record<string, FacetBucket[]>;
}

export interface SearchParams {
  q?: string;
  filter?: Record<string, string>;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'name_asc';
  page?: number;
  pageSize?: number;
}
