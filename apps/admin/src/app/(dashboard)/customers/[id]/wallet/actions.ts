'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { WalletView } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function creditWallet(customerPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const bucket = String(formData.get('bucket') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!amount) return { error: 'Amount is required.', success: false };

  try {
    await apiPost<WalletView>(`/admin/v1/customers/${customerPublicId}/wallet/actions/credit`, {
      amount,
      bucket,
      source,
      reason: reason || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/customers/${customerPublicId}/wallet`);
  return { error: null, success: true };
}

/** `amount` is signed here — a positive string credits, a negative string ("-5.00")
 *  is a guarded debit that 409s if it would overdraw the balance or the wallet is frozen. */
export async function adjustWallet(customerPublicId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const amount = String(formData.get('amount') ?? '').trim();
  const bucket = String(formData.get('bucket') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!amount) return { error: 'Amount is required.', success: false };
  if (!reason) return { error: 'Reason is required.', success: false };

  try {
    await apiPost<WalletView>(`/admin/v1/customers/${customerPublicId}/wallet/actions/adjust`, { amount, bucket, reason });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/customers/${customerPublicId}/wallet`);
  return { error: null, success: true };
}

export async function freezeWallet(customerPublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<void>(`/admin/v1/customers/${customerPublicId}/wallet/actions/freeze`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }
  revalidatePath(`/customers/${customerPublicId}/wallet`);
  return { error: null, success: true };
}

export async function unfreezeWallet(customerPublicId: string, _prevState: ActionState): Promise<ActionState> {
  try {
    await apiPost<void>(`/admin/v1/customers/${customerPublicId}/wallet/actions/unfreeze`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }
  revalidatePath(`/customers/${customerPublicId}/wallet`);
  return { error: null, success: true };
}
