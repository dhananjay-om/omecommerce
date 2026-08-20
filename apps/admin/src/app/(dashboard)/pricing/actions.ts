'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { PriceList, PriceListType } from '@/lib/types';
import { resolveProductBySkuCascade } from '@/lib/resolve-product-by-sku';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export interface PriceableVariant {
  publicId: string;
  sku: string;
  label: string;
}

export interface FindProductState {
  error: string | null;
  product: {
    publicId: string;
    sku: string;
    name: string | null;
    variants: PriceableVariant[];
    /** Auto-selected when unambiguous — a simple product's one implicit
     *  variant, or when the typed SKU exactly matched one specific variant. */
    preselectedVariantId: string | null;
  } | null;
}

/** Same SKU-search UX as Inventory's "Adjust Stock" — Set Price otherwise needs a
 *  raw variant public ID, which is exactly the friction that dialog used to have. */
export async function findProductForPricing(
  _prevState: FindProductState,
  formData: FormData,
): Promise<FindProductState> {
  const sku = String(formData.get('sku') ?? '').trim();
  if (!sku) {
    return { error: 'Enter a SKU.', product: null };
  }

  let detail;
  try {
    detail = await resolveProductBySkuCascade(sku);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, product: null };
    throw err;
  }
  if (!detail) {
    return { error: `No product found matching SKU "${sku}".`, product: null };
  }

  const variants: PriceableVariant[] = detail.variants.map((v) => ({
    publicId: v.publicId,
    sku: v.sku,
    label: v.axisValues.length
      ? `${v.sku} — ${v.axisValues.map((a) => `${a.attributeLabel}: ${a.optionLabel}`).join(', ')}`
      : v.sku,
  }));
  const exactVariant = variants.find((v) => v.sku.toLowerCase() === sku.toLowerCase());

  return {
    error: null,
    product: {
      publicId: detail.publicId,
      sku: detail.sku,
      name: detail.name,
      variants,
      preselectedVariantId:
        exactVariant?.publicId ?? (variants.length === 1 ? variants[0].publicId : null),
    },
  };
}

export async function createPriceList(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const currency = String(formData.get('currency') ?? '')
    .trim()
    .toUpperCase();
  const type = String(formData.get('type') ?? '') as PriceListType | '';
  const priorityRaw = String(formData.get('priority') ?? '').trim();
  const priority = priorityRaw ? Number(priorityRaw) : undefined;
  const customerGroupCodeRaw = String(formData.get('customerGroupCode') ?? '').trim();
  const customerGroupCode = customerGroupCodeRaw === '__none__' ? '' : customerGroupCodeRaw;

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
      customerGroupCode: customerGroupCode || undefined,
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

export async function updatePriceList(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const currency = String(formData.get('currency') ?? '')
    .trim()
    .toUpperCase();
  const type = String(formData.get('type') ?? '') as PriceListType | '';
  const priorityRaw = String(formData.get('priority') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? 'true') === 'true';

  if (!code || !name || currency.length !== 3) {
    return { error: 'Name and a 3-letter currency code are required.', success: false };
  }

  try {
    await apiPatch<PriceList>(`/admin/v1/price-lists/${code}`, {
      name,
      currency,
      type: type || undefined,
      priority: priorityRaw ? Number(priorityRaw) : undefined,
      isActive,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/pricing');
  return { error: null, success: true };
}

export async function deletePriceList(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    return { error: 'Missing price list code.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/price-lists/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/pricing');
  return { error: null, success: true };
}
