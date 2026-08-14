'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { TaxClass } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** Admin types a percent (e.g. "18"); the backend stores/expects the fraction
 *  ("0.18") — same unit TaxClass.rate/OrderTaxLine.rate/GstTaxType math all use. */
function percentToFraction(percent: string): string {
  const n = Number(percent);
  return (n / 100).toString();
}

export async function createTaxClass(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const percent = String(formData.get('percent') ?? '').trim();

  if (!code || !name || !percent) {
    return { error: 'Code, name, and GST rate are required.', success: false };
  }

  try {
    await apiPost<TaxClass>('/admin/v1/tax-classes', { code, name, rate: percentToFraction(percent) });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/tax-classes');
  return { error: null, success: true };
}

export async function updateTaxClass(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const percent = String(formData.get('percent') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing tax class code.', success: false };

  try {
    await apiPatch<TaxClass>(`/admin/v1/tax-classes/${code}`, {
      name: name || undefined,
      rate: percent ? percentToFraction(percent) : undefined,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/tax-classes');
  return { error: null, success: true };
}

export async function deleteTaxClass(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { error: 'Missing tax class code.', success: false };

  try {
    await apiDelete(`/admin/v1/tax-classes/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/tax-classes');
  return { error: null, success: true };
}
