'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, ApiError } from '@/lib/api-client';
import type { Website } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateWalletSettings(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const walletEnabled = String(formData.get('walletEnabled') ?? 'true') === 'true';
  const walletMaxPercentOfOrder = String(formData.get('walletMaxPercentOfOrder') ?? '').trim();
  const walletMinOrderValue = String(formData.get('walletMinOrderValue') ?? '').trim();
  const walletMaxAmountPerOrder = String(formData.get('walletMaxAmountPerOrder') ?? '').trim();

  if (!code) return { error: 'Missing website code.', success: false };
  // Same friendly-client-side-mirror discipline as gst-settings/actions.ts —
  // the backend's own DB CHECKs are the real guarantee, this just avoids a
  // round trip for the common typo.
  if (
    walletMaxPercentOfOrder &&
    (Number(walletMaxPercentOfOrder) <= 0 || Number(walletMaxPercentOfOrder) > 100)
  ) {
    return { error: 'Max % of order must be greater than 0 and at most 100.', success: false };
  }
  if (walletMinOrderValue && Number(walletMinOrderValue) < 0) {
    return { error: 'Minimum order value must not be negative.', success: false };
  }
  if (walletMaxAmountPerOrder && Number(walletMaxAmountPerOrder) <= 0) {
    return { error: 'Max wallet amount per order must be greater than 0.', success: false };
  }

  try {
    await apiPatch<Website>(`/admin/v1/websites/${code}/wallet-settings`, {
      walletEnabled,
      walletMaxPercentOfOrder: walletMaxPercentOfOrder || null,
      walletMinOrderValue: walletMinOrderValue || null,
      walletMaxAmountPerOrder: walletMaxAmountPerOrder || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/wallet-settings');
  return { error: null, success: true };
}
