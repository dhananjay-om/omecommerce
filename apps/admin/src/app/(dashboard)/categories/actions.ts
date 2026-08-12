'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { Category } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const nameDefault = String(formData.get('nameDefault') ?? '').trim();
  const parentId = String(formData.get('parentId') ?? '').trim();

  if (!nameDefault) {
    return { error: 'Name is required.', success: false };
  }

  try {
    await apiPost<Category>('/admin/v1/categories', { nameDefault, parentId: parentId || undefined });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/categories');
  return { error: null, success: true };
}

export async function renameCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const nameDefault = String(formData.get('nameDefault') ?? '').trim();

  if (!nameDefault) {
    return { error: 'Name is required.', success: false };
  }

  try {
    await apiPatch<Category>(`/admin/v1/categories/${publicId}`, { nameDefault });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/categories');
  return { error: null, success: true };
}

export interface DeleteCategoryResult {
  error: string | null;
}

export async function deleteCategory(publicId: string): Promise<DeleteCategoryResult> {
  try {
    await apiDelete(`/admin/v1/categories/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath('/categories');
  return { error: null };
}
