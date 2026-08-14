'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, ApiError } from '@/lib/api-client';
import type { Website } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateGstSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const gstin = String(formData.get('gstin') ?? '').trim().toUpperCase();
  const originStateCode = String(formData.get('originStateCode') ?? '').trim();

  if (!code) return { error: 'Missing website code.', success: false };
  // Both-or-neither — same pairing the backend's CHECK constraint enforces.
  if (!!gstin !== !!originStateCode) {
    return { error: 'GSTIN and origin state must be set together (or both left blank).', success: false };
  }

  try {
    await apiPatch<Website>(`/admin/v1/websites/${code}/tax-settings`, {
      gstin: gstin || null,
      originStateCode: originStateCode || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/gst-settings');
  return { error: null, success: true };
}
