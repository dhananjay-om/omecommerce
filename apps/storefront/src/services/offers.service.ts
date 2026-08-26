import 'server-only';
import { apiGet } from '@/lib/api-client';
import type { ProductOffer } from '@/types/offer';

/** Public, unauthenticated — same posture as browsing the product itself. */
export function getProductOffers(productId: string): Promise<ProductOffer[]> {
  return apiGet<ProductOffer[]>(`/store/v1/products/${productId}/offers`);
}
