'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { Attribute, AttributeDataType, AttributeInputType } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createAttribute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const dataType = String(formData.get('dataType') ?? '') as AttributeDataType | '';
  const inputType = String(formData.get('inputType') ?? '') as AttributeInputType | '';
  const isRequired = formData.get('isRequired') === 'on';
  const isFilterable = formData.get('isFilterable') === 'on';
  const isSearchable = formData.get('isSearchable') === 'on';
  const isComparable = formData.get('isComparable') === 'on';
  const isVariantForming = formData.get('isVariantForming') === 'on';

  let options: Array<{ value: string; label: string }> = [];
  const optionsRaw = String(formData.get('options') ?? '');
  if (optionsRaw) {
    try {
      options = JSON.parse(optionsRaw);
    } catch {
      return { error: 'Options were malformed.', success: false };
    }
  }

  if (!code || !label || !dataType || !inputType) {
    return { error: 'Code, label, data type, and input type are required.', success: false };
  }

  try {
    await apiPost<Attribute>('/admin/v1/attributes', {
      code,
      label,
      dataType,
      inputType,
      isRequired,
      isFilterable,
      isSearchable,
      isComparable,
      isVariantForming,
      options: options.length ? options : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/attributes');
  return { error: null, success: true };
}

export async function updateAttribute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  if (!code || !label) {
    return { error: 'Missing attribute code or label.', success: false };
  }

  try {
    await apiPatch<Attribute>(`/admin/v1/attributes/${code}`, {
      label,
      isRequired: formData.get('isRequired') === 'on',
      isFilterable: formData.get('isFilterable') === 'on',
      isSearchable: formData.get('isSearchable') === 'on',
      isComparable: formData.get('isComparable') === 'on',
      isVariantForming: formData.get('isVariantForming') === 'on',
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/attributes');
  revalidatePath('/attribute-sets');
  return { error: null, success: true };
}

export async function deleteAttribute(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    return { error: 'Missing attribute code.', success: false };
  }

  try {
    await apiDelete(`/admin/v1/attributes/${code}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/attributes');
  revalidatePath('/attribute-sets');
  return { error: null, success: true };
}
