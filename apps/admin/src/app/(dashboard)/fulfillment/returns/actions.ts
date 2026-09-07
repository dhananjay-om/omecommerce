'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export const initialActionState: ActionState = { error: null, success: false };

/** Moves a return through its non-monetary lifecycle (REQUESTED ->
 *  APPROVED -> RECEIVED, or REJECTED from either) — see
 *  UpdateReturnStatus's own doc comment on why REFUNDED isn't reachable
 *  through this action. */
export async function updateReturnStatus(returnPublicId: string, status: 'APPROVED' | 'RECEIVED' | 'REJECTED', _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPatch<void>(`/admin/v1/returns/${returnPublicId}/status`, { status });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/fulfillment/returns');
  return { error: null, success: true };
}

/** The money-moving step — reuses the existing RefundOrder usecase on the
 *  backend (see RefundReturn's own doc comment), not a second refund
 *  engine. Only valid from APPROVED or RECEIVED. */
export async function refundReturn(returnPublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<unknown>(`/admin/v1/returns/${returnPublicId}/refund`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/fulfillment/returns');
  // Reusing RefundOrder means a real new PaymentTransaction row exists now
  // — the Refunds ledger (Phase 3) needs to reflect it too.
  revalidatePath('/fulfillment/refunds');
  return { error: null, success: true };
}
