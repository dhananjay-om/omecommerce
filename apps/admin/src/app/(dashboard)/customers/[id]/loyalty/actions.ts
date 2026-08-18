'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { LoyaltyAccount } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** `points` is signed here, same convention as Wallet's adjustWallet — a positive string
 *  grants, a negative string ("-100") is a guarded correction that 409s if it would take
 *  the balance below zero. */
export async function adjustLoyaltyAccount(customerPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const points = String(formData.get('points') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!points) return { error: 'Points is required.', success: false };
  if (!reason) return { error: 'Reason is required.', success: false };

  try {
    await apiPost<LoyaltyAccount>(`/admin/v1/customers/${customerPublicId}/loyalty/actions/adjust`, { points, reason });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/customers/${customerPublicId}/loyalty`);
  return { error: null, success: true };
}
