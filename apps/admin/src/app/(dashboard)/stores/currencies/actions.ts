'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, ApiError } from '@/lib/api-client';
import type { Currency } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createCurrency(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const symbol = String(formData.get('symbol') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const minorUnitsRaw = String(formData.get('minorUnits') ?? '').trim();

  if (code.length !== 3 || !symbol || !name) {
    return { error: 'A 3-letter code, symbol, and name are required.', success: false };
  }

  try {
    await apiPost<Currency>('/admin/v1/currencies', {
      code,
      symbol,
      name,
      minorUnits: minorUnitsRaw ? Number(minorUnitsRaw) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/currencies');
  return { error: null, success: true };
}

export async function updateCurrency(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const symbol = String(formData.get('symbol') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const minorUnitsRaw = String(formData.get('minorUnits') ?? '').trim();

  if (!code || !symbol || !name) {
    return { error: 'Symbol and name are required.', success: false };
  }

  try {
    await apiPatch<Currency>(`/admin/v1/currencies/${code}`, {
      symbol,
      name,
      minorUnits: minorUnitsRaw ? Number(minorUnitsRaw) : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/currencies');
  return { error: null, success: true };
}
