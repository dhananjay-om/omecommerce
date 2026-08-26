'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, ApiError } from '@/lib/api-client';

export interface ModerateResult {
  error: string | null;
}

/** Shared between the per-product Reviews tab and the cross-product
 *  Commerce > Reviews queue — both moderate through the same
 *  PATCH /admin/v1/products/:id/reviews/:reviewId/moderate route. */
export async function moderateReview(productId: string, reviewId: string, isApproved: boolean): Promise<ModerateResult> {
  try {
    await apiPatch(`/admin/v1/products/${productId}/reviews/${reviewId}/moderate`, { isApproved });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/products/${productId}/reviews`);
  revalidatePath('/reviews');
  return { error: null };
}
