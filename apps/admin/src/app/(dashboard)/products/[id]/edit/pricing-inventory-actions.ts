'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

/** Same endpoint the standalone Pricing page uses; scoped here to the product-edit page's revalidation. */
export async function setVariantPrice(
  productPublicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const priceListCode = String(formData.get('priceListCode') ?? '').trim();
  const variantId = String(formData.get('variantId') ?? '').trim();
  const price = String(formData.get('price') ?? '').trim();
  const mrp = String(formData.get('mrp') ?? '').trim();

  if (!priceListCode || !variantId || !price) {
    return { error: 'A price is required.', success: false };
  }

  try {
    await apiPut(`/admin/v1/price-lists/${priceListCode}/prices`, { variantId, price, mrp: mrp || null });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  return { error: null, success: true };
}

/** Same endpoint the standalone Inventory page uses; scoped here to the product-edit page's revalidation. */
export async function adjustVariantStock(
  productPublicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const variantId = String(formData.get('variantId') ?? '').trim();
  const warehouseCode = String(formData.get('warehouseCode') ?? '').trim();
  const delta = Number(formData.get('delta'));
  const reason = String(formData.get('reason') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!variantId || !warehouseCode || !reason || !Number.isInteger(delta) || delta === 0) {
    return { error: 'A non-zero whole-number quantity and a reason are required.', success: false };
  }

  try {
    await apiPost('/admin/v1/inventory/adjustments', {
      variantId,
      warehouseCode,
      delta,
      reason,
      note: note || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  return { error: null, success: true };
}
