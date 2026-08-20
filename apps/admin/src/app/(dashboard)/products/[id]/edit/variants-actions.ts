'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export interface GenerateVariantsResult {
  created: number;
  skipped: number;
}

export interface GenerateVariantsState {
  error: string | null;
  result: GenerateVariantsResult | null;
}

/** Reads `axis__<attributeCode>` checkbox groups from the form (one per eligible axis attribute,
 * values = chosen AttributeOption ids) and posts them as the /variants/generate axes payload. */
export async function generateVariants(
  productPublicId: string,
  _prevState: GenerateVariantsState,
  formData: FormData,
): Promise<GenerateVariantsState> {
  const axes: Array<{ attributeCode: string; optionIds: string[] }> = [];
  for (const [key, values] of Object.entries(groupFormData(formData))) {
    if (values.length === 0) continue;
    axes.push({ attributeCode: key, optionIds: values });
  }

  if (axes.length === 0) {
    return { error: 'Pick at least one axis attribute and at least one option for it.', result: null };
  }

  try {
    const result = await apiPost<GenerateVariantsResult>(`/admin/v1/products/${productPublicId}/variants/generate`, { axes });
    revalidatePath(`/products/${productPublicId}/edit`);
    revalidatePath(`/products/${productPublicId}`);
    return { error: null, result };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, result: null };
    throw err;
  }
}

function groupFormData(formData: FormData): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of formData.keys()) {
    if (!key.startsWith('axis__')) continue;
    const code = key.slice('axis__'.length);
    groups[code] = formData.getAll(key).map(String);
  }
  return groups;
}

export async function updateVariant(
  productPublicId: string,
  variantPublicId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sku = String(formData.get('sku') ?? '').trim();
  const status = String(formData.get('status') ?? '');

  try {
    await apiPatch(`/admin/v1/products/${productPublicId}/variants/${variantPublicId}`, {
      sku: sku || undefined,
      status: status || undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  revalidatePath(`/products/${productPublicId}`);
  return { error: null, success: true };
}

export async function deleteVariant(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const productPublicId = String(formData.get('productPublicId') ?? '').trim();
  const variantPublicId = String(formData.get('variantPublicId') ?? '').trim();
  if (!productPublicId || !variantPublicId) {
    return { error: 'Missing product or variant id.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/products/${productPublicId}/variants/${variantPublicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  revalidatePath(`/products/${productPublicId}`);
  return { error: null, success: true };
}
