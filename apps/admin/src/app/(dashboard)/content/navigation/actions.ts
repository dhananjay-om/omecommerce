'use server';

import { revalidatePath } from 'next/cache';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { MegaMenuItem, MegaMenuColumn, MegaMenuPromoImagePosition } from '@/lib/types';

export interface MegaMenuItemPayload {
  label: string;
  href: string;
  position?: number;
  isActive?: boolean;
  columns: MegaMenuColumn[];
  promoImageMediaKey?: string | null;
  promoHref?: string | null;
  promoCaption?: string | null;
  panelWidth?: number | null;
  columnGap?: number | null;
  promoImageWidth?: number | null;
  promoImageHeight?: number | null;
  promoImagePosition?: MegaMenuPromoImagePosition;
}

export interface ActionResult {
  error: string | null;
  publicId?: string;
}

export async function createMegaMenuItem(payload: MegaMenuItemPayload): Promise<ActionResult> {
  try {
    const item = await apiPost<MegaMenuItem>('/admin/v1/navigation/mega-menu-items', payload);
    revalidatePath('/content/navigation');
    return { error: null, publicId: item.publicId };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}

export async function updateMegaMenuItem(publicId: string, payload: MegaMenuItemPayload): Promise<ActionResult> {
  try {
    await apiPut<MegaMenuItem>(`/admin/v1/navigation/mega-menu-items/${publicId}`, payload);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/content/navigation');
  revalidatePath(`/content/navigation/${publicId}/edit`);
  return { error: null, publicId };
}

export async function deleteMegaMenuItem(publicId: string): Promise<ActionResult> {
  try {
    await apiDelete(`/admin/v1/navigation/mega-menu-items/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/content/navigation');
  return { error: null };
}

/** Quick "move up/down" without opening the full editor — just a
 *  position swap, reusing the same update route. */
export async function setMegaMenuItemPosition(publicId: string, position: number): Promise<ActionResult> {
  try {
    await apiPut<MegaMenuItem>(`/admin/v1/navigation/mega-menu-items/${publicId}`, { position });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
  revalidatePath('/content/navigation');
  return { error: null };
}

export interface ImageUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  imageMediaKey?: string;
}

/** Step 1 of the promo image's direct-to-storage flow (same pattern as
 *  banners/actions.ts's requestBannerImageUpload). */
export async function requestMegaMenuImageUpload(filename: string, mimeType: string): Promise<ImageUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; imageMediaKey: string }>('/admin/v1/navigation/mega-menu-items/image-upload-url', {
      filename,
      mimeType,
    });
    return { error: null, uploadUrl: res.uploadUrl, imageMediaKey: res.imageMediaKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
