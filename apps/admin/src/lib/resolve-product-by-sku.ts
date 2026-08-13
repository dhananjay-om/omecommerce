import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { ProductList, ProductDetail } from '@/lib/types';

/**
 * Resolves a typed SKU to a product, even when what was typed is a full
 * VARIANT sku (not the base product sku) for a configurable product.
 * There's no backend endpoint that searches variant SKUs directly — the
 * admin product search only matches product.sku via `contains` (see
 * list-products.usecase.ts), which can never match a search term LONGER
 * than the field it's checked against. Variant SKUs are always
 * `${productSku}-${slugifiedOptionValue}-...` (generate-product-variants
 * .usecase.ts), so instead we progressively strip trailing `-segment`s off
 * the typed input and retry the product search at each shorter prefix,
 * stopping at the first exact product.sku match. Bounded by the input's own
 * hyphen count, so this can't loop pathologically.
 *
 * Shared by Inventory's "Adjust Stock" and Pricing's "Set Price" — both
 * need to turn a typed SKU into a variant, since neither the stock nor the
 * price-list write endpoints take a SKU directly (only a variant public ID).
 */
export async function resolveProductBySkuCascade(originalInput: string): Promise<ProductDetail | null> {
  let candidate: string | null = originalInput;
  while (candidate) {
    const list = await apiGet<ProductList>(`/admin/v1/products?search=${encodeURIComponent(candidate)}&pageSize=20`);
    const exact = list.products.find((p) => p.sku.toLowerCase() === candidate!.toLowerCase());
    if (exact) {
      return apiGet<ProductDetail>(`/admin/v1/products/${exact.publicId}`);
    }
    const lastDash = candidate.lastIndexOf('-');
    candidate = lastDash > 0 ? candidate.slice(0, lastDash) : null;
  }
  return null;
}
