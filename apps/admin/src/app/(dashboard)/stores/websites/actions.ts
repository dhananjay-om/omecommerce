'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { Website } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** Creates a Website + its default Store + Store View together in one
 *  action — see CreateStore's own doc comment for why this isn't 3
 *  separate form fields. Currency is create-time-only: there's no matching
 *  update action, deliberately (see the backend use case's doc comment). */
export async function createStore(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const websiteCode = String(formData.get('websiteCode') ?? '').trim();
  const websiteName = String(formData.get('websiteName') ?? '').trim();
  const currency = String(formData.get('currency') ?? '').trim();

  if (!websiteCode || !websiteName || !currency) {
    return { error: 'Website code, name, and currency are required.', success: false };
  }

  try {
    await apiPost<Website>('/admin/v1/websites', { websiteCode, websiteName, currency });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/websites');
  revalidatePath('/stores/general');
  revalidatePath('/stores/gst-settings');
  revalidatePath('/stores/wallet-settings');
  return { error: null, success: true };
}
