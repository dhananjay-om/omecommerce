'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiDelete, ApiError } from '@/lib/api-client';

export interface RequestUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  storageKey?: string;
}

/** Step 1 of the direct-to-storage upload flow — mints a presigned PUT URL the browser uploads bytes to directly. */
export async function requestUploadUrl(filename: string, mimeType: string): Promise<RequestUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; storageKey: string }>('/admin/v1/media/uploads', { filename, mimeType });
    return { error: null, uploadUrl: res.uploadUrl, storageKey: res.storageKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}

export interface ConfirmUploadResult {
  error: string | null;
}

/** Steps 3-4: once the browser's direct PUT to storage has completed, register the object and attach it to the product's gallery. */
export async function confirmMediaUpload(
  productPublicId: string,
  storageKey: string,
  mimeType: string,
  bytes: number,
  width?: number,
  height?: number,
): Promise<ConfirmUploadResult> {
  try {
    const asset = await apiPost<{ publicId: string }>('/admin/v1/media', { storageKey, mimeType, bytes, width, height });
    await apiPost(`/admin/v1/products/${productPublicId}/media`, { mediaPublicId: asset.publicId });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  revalidatePath(`/products/${productPublicId}`);
  revalidatePath('/products');
  return { error: null };
}

export interface DetachMediaResult {
  error: string | null;
}

export async function detachMedia(productPublicId: string, productMediaId: string): Promise<DetachMediaResult> {
  try {
    await apiDelete(`/admin/v1/products/${productPublicId}/media/${productMediaId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  revalidatePath(`/products/${productPublicId}`);
  revalidatePath('/products');
  return { error: null };
}

export interface SetThumbnailResult {
  error: string | null;
}

/** Marks one image as the product's "main image" — used wherever only a single thumbnail is shown (collection/PLP grid, search hits, mini-cart, cart line, admin grid). */
export async function setThumbnail(productPublicId: string, productMediaId: string): Promise<SetThumbnailResult> {
  try {
    await apiPost(`/admin/v1/products/${productPublicId}/media/${productMediaId}/set-thumbnail`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/products/${productPublicId}/edit`);
  revalidatePath(`/products/${productPublicId}`);
  revalidatePath('/products');
  return { error: null };
}
