'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { ShippingMethod } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createShippingMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const flatRate = String(formData.get('flatRate') ?? '').trim();
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase();

  if (!code || !name || !flatRate || currency.length !== 3) {
    return { error: 'Code, name, rate, and a 3-letter currency are required.', success: false };
  }

  try {
    await apiPost<ShippingMethod>('/admin/v1/shipping-methods', { code, name, flatRate, currency });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/shipping-methods');
  return { error: null, success: true };
}

export async function updateShippingMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const flatRate = String(formData.get('flatRate') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing shipping method code.', success: false };

  try {
    await apiPatch<ShippingMethod>(`/admin/v1/shipping-methods/${code}`, {
      name: name || undefined,
      flatRate: flatRate || undefined,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/shipping-methods');
  return { error: null, success: true };
}

export async function deleteShippingMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { error: 'Missing shipping method code.', success: false };

  try {
    await apiDelete(`/admin/v1/shipping-methods/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/shipping-methods');
  return { error: null, success: true };
}
