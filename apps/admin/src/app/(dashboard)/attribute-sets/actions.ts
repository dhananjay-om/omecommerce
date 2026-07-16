'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, ApiError } from '@/lib/api-client';
import type { AttributeSet, AttributeSetGroupDetail } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createAttributeSet(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const isDefault = formData.get('isDefault') === 'on';

  if (!code || !name) {
    return { error: 'Code and name are required.', success: false };
  }

  try {
    await apiPost<AttributeSet>('/admin/v1/attribute-sets', { code, name, isDefault });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/attribute-sets');
  return { error: null, success: true };
}

export async function createAttributeSetGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const attributeSetId = String(formData.get('attributeSetId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;

  if (!attributeSetId || !name) {
    return { error: 'Name is required.', success: false };
  }

  try {
    await apiPost<AttributeSetGroupDetail>(`/admin/v1/attribute-sets/${attributeSetId}/groups`, { name, sortOrder });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/attribute-sets/${attributeSetId}`);
  return { error: null, success: true };
}

export async function assignAttributeToGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const attributeSetId = String(formData.get('attributeSetId') ?? '').trim();
  const groupId = String(formData.get('groupId') ?? '').trim();
  const attributeCode = String(formData.get('attributeCode') ?? '').trim();
  const sortOrderRaw = String(formData.get('sortOrder') ?? '').trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;

  if (!attributeSetId || !groupId || !attributeCode) {
    return { error: 'An attribute is required.', success: false };
  }

  try {
    await apiPost(`/admin/v1/attribute-sets/${attributeSetId}/attributes`, { groupId, attributeCode, sortOrder });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath(`/attribute-sets/${attributeSetId}`);
  return { error: null, success: true };
}
