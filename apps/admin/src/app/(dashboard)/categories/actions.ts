'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPatch, apiPut, apiDelete, ApiError } from '@/lib/api-client';
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

/** Full edit page's save action — scalar fields go through the PATCH endpoint;
 *  a changed parent additionally goes through the separate reparent endpoint
 *  (moving a category through the tree is a distinct operation from updating
 *  its own fields, same split the backend already exposes). */
export async function updateCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const nameDefault = String(formData.get('nameDefault') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const sortMode = String(formData.get('sortMode') ?? '').trim();
  const includeInMenu = String(formData.get('includeInMenu') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const imageMediaKey = String(formData.get('imageMediaKey') ?? '').trim();
  const metaTitle = String(formData.get('metaTitle') ?? '').trim();
  const metaDescription = String(formData.get('metaDescription') ?? '').trim();
  const metaKeywords = String(formData.get('metaKeywords') ?? '').trim();
  const originalParentId = String(formData.get('originalParentId') ?? '').trim();
  const parentId = String(formData.get('parentId') ?? '').trim();

  if (!nameDefault) {
    return { error: 'Name is required.', success: false };
  }

  try {
    await apiPatch<Category>(`/admin/v1/categories/${publicId}`, {
      nameDefault,
      position: position ? Number(position) : undefined,
      sortMode: sortMode || undefined,
      includeInMenu: includeInMenu ? includeInMenu === 'true' : undefined,
      description: description || null,
      imageMediaKey: imageMediaKey || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      metaKeywords: metaKeywords || null,
    });

    if (parentId !== originalParentId) {
      await apiPut<Category>(`/admin/v1/categories/${publicId}/parent`, { newParentId: parentId || null });
    }
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/categories');
  revalidatePath(`/categories/${publicId}/edit`);
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

export interface ImageUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  imageMediaKey?: string;
}

/** Step 1 of the category image's direct-to-storage flow (same pattern as the
 *  store logo upload) — mints a presigned PUT URL the browser then uploads
 *  straight to, never proxied through this server. The returned imageMediaKey
 *  isn't persisted yet; it's submitted with the rest of this form's fields on
 *  Save, not confirmed separately. */
export async function requestCategoryImageUpload(publicId: string, filename: string, mimeType: string): Promise<ImageUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; imageMediaKey: string }>(`/admin/v1/categories/${publicId}/image-upload-url`, {
      filename,
      mimeType,
    });
    return { error: null, uploadUrl: res.uploadUrl, imageMediaKey: res.imageMediaKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
