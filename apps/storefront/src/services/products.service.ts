import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import { STORE_VIEW_ID } from '@/lib/config';
import type { ProductDetail, SearchResult, SearchParams } from '@/types/product';

/** Server Component reads only — direct to Express, matching how every browse/PDP page fetches for SSR/SEO. */
export function getProduct(publicId: string): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/store/v1/products/${publicId}${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}

/** The PDP's real entry point (/{slug}.html) — see catalog.module.ts's /products/by-slug/:slug route. */
export function getProductBySlug(slug: string): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/store/v1/products/by-slug/${slug}${buildQuery({ storeViewId: STORE_VIEW_ID })}`);
}

export function searchProducts(params: SearchParams = {}): Promise<SearchResult> {
  let qs = buildQuery({
    storeViewId: STORE_VIEW_ID,
    q: params.q,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    inStock: params.inStock,
  });
  for (const [field, value] of Object.entries(params.filter ?? {})) {
    qs += `${qs ? '&' : '?'}filter[${encodeURIComponent(field)}]=${encodeURIComponent(value)}`;
  }
  return apiGet<SearchResult>(`/store/v1/search${qs}`);
}
