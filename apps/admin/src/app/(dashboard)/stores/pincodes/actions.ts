'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, ApiError } from '@/lib/api-client';
import type { Pincode, BulkUpsertPincodesResult } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createPincode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const estimatedDays = Number(formData.get('estimatedDays') ?? '');
  const codAvailable = String(formData.get('codAvailable') ?? 'true') === 'true';

  if (!/^\d{6}$/.test(code) || !city || !state || !Number.isFinite(estimatedDays)) {
    return { error: 'A valid 6-digit code, city, state, and estimated days are required.', success: false };
  }

  try {
    await apiPost<Pincode>('/admin/v1/pincodes', { code, city, state, estimatedDays, codAvailable });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/pincodes');
  return { error: null, success: true };
}

export async function updatePincode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const estimatedDays = Number(formData.get('estimatedDays') ?? '');
  const codAvailable = String(formData.get('codAvailable') ?? 'true') === 'true';
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing pincode.', success: false };

  try {
    await apiPatch<Pincode>(`/admin/v1/pincodes/${code}`, { city, state, estimatedDays, codAvailable, isActive });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/pincodes');
  return { error: null, success: true };
}

export interface BulkAddRow {
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
}

export interface BulkAddState {
  error: string | null;
  result: BulkUpsertPincodesResult | null;
}

/** Called imperatively (not useActionState) — same shape as products'
 *  submitBulkUpsertProducts, since the caller already has parsed rows in
 *  hand from a client-side CSV parse, not raw FormData. */
export async function bulkAddPincodes(rows: BulkAddRow[]): Promise<BulkAddState> {
  if (rows.length === 0) return { error: 'No valid rows to add.', result: null };
  try {
    const result = await apiPost<BulkUpsertPincodesResult>('/admin/v1/pincodes/bulk', { rows });
    revalidatePath('/stores/pincodes');
    return { error: null, result };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, result: null };
    throw err;
  }
}
