'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { PaymentMethod } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createPaymentMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();

  if (!code || !name || (type !== 'COD' && type !== 'ONLINE')) {
    return { error: 'Code, name, and a type are required.', success: false };
  }

  try {
    await apiPost<PaymentMethod>('/admin/v1/payment-methods', { code, name, type });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/payment-methods');
  return { error: null, success: true };
}

export async function updatePaymentMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code) return { error: 'Missing payment method code.', success: false };

  try {
    await apiPatch<PaymentMethod>(`/admin/v1/payment-methods/${code}`, {
      name: name || undefined,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/payment-methods');
  return { error: null, success: true };
}

export async function deletePaymentMethod(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { error: 'Missing payment method code.', success: false };

  try {
    await apiDelete(`/admin/v1/payment-methods/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/payment-methods');
  return { error: null, success: true };
}
