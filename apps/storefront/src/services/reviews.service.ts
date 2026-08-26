import 'server-only';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { ProductReviewList } from '@/types/review';

/** Public, unauthenticated, approved-only — same route the client-side
 *  pagination in ProductReviews re-fetches from via the /api proxy. */
export function getProductReviews(productId: string, page = 1, pageSize = 10): Promise<ProductReviewList> {
  return apiGet<ProductReviewList>(`/store/v1/products/${productId}/reviews${buildQuery({ page, pageSize })}`);
}
