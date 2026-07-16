'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, ApiError } from '@/lib/api-client';
import type { PriceList, PriceListType } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createPriceList(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
  const type = String(formData.get('type') ?? '') as PriceListType | '';
  const priorityRaw = String(formData.get('priority') ?? '').trim();
  const priority = priorityRaw ? Number(priorityRaw) : undefined;

  if (!code || !name || currency.length !== 3) {
    return { error: 'Code, name, and a 3-letter currency code are required.', success: false };
  }

  try {
    await apiPost<PriceList>('/admin/v1/price-lists', {
      code,
      name,
      currency,
      type: type || undefined,
      priority,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/pricing');
  return { error: null, success: true };
}

export async function setPrice(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const priceListCode = String(formData.get('priceListCode') ?? '').trim();
  const variantId = String(formData.get('variantId') ?? '').trim();
  const price = String(formData.get('price') ?? '').trim();

  if (!priceListCode || !variantId || !price) {
    return { error: 'Variant and price are required.', success: false };
  }

  try {
    await apiPut(`/admin/v1/price-lists/${priceListCode}/prices`, { variantId, price });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/pricing');
  return { error: null, success: true };
}
