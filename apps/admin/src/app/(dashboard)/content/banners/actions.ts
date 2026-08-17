'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client';
import type { Banner, BannerGroup } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function createBanner(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const group = String(formData.get('group') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const subtitle = String(formData.get('subtitle') ?? '').trim();
  const imageMediaKey = String(formData.get('imageMediaKey') ?? '').trim();
  const ctaLabel = String(formData.get('ctaLabel') ?? '').trim();
  const ctaHref = String(formData.get('ctaHref') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? '').trim();

  if (!group) return { error: 'Group is required.', success: false };
  if (!title) return { error: 'Title is required.', success: false };

  let publicId: string;
  try {
    const banner = await apiPost<Banner>('/admin/v1/banners', {
      group,
      title,
      subtitle: subtitle || undefined,
      imageMediaKey: imageMediaKey || undefined,
      ctaLabel: ctaLabel || undefined,
      ctaHref: ctaHref || undefined,
      position: position ? Number(position) : undefined,
      isActive: isActive ? isActive === 'true' : undefined,
    });
    publicId = banner.publicId;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/banners');
  redirect(`/content/banners/${publicId}/edit`);
}

export async function updateBanner(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const subtitle = String(formData.get('subtitle') ?? '').trim();
  const imageMediaKey = String(formData.get('imageMediaKey') ?? '').trim();
  const ctaLabel = String(formData.get('ctaLabel') ?? '').trim();
  const ctaHref = String(formData.get('ctaHref') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? '').trim();

  if (!title) return { error: 'Title is required.', success: false };

  try {
    await apiPut<Banner>(`/admin/v1/banners/${publicId}`, {
      title,
      subtitle: subtitle || null,
      imageMediaKey: imageMediaKey || null,
      ctaLabel: ctaLabel || null,
      ctaHref: ctaHref || null,
      position: position ? Number(position) : undefined,
      isActive: isActive ? isActive === 'true' : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/banners');
  revalidatePath(`/content/banners/${publicId}/edit`);
  return { error: null, success: true };
}

export async function deleteBanner(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const publicId = String(formData.get('publicId') ?? '').trim();
  if (!publicId) return { error: 'Missing banner id.', success: false };

  try {
    await apiDelete(`/admin/v1/banners/${publicId}`);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/content/banners');
  return { error: null, success: true };
}

export interface ImageUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  imageMediaKey?: string;
}

/** Step 1 of the banner image's direct-to-storage flow (same pattern as
 *  category-image-upload-field.tsx) — mints a presigned PUT URL the browser
 *  then uploads straight to, never proxied through this server. No existing
 *  Banner row is required (unlike Category's image field, which only
 *  appears once the row already exists) — the create form itself can upload
 *  before Create is clicked. */
export async function requestBannerImageUpload(group: BannerGroup, filename: string, mimeType: string): Promise<ImageUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; imageMediaKey: string }>('/admin/v1/banners/image-upload-url', {
      group,
      filename,
      mimeType,
    });
    return { error: null, uploadUrl: res.uploadUrl, imageMediaKey: res.imageMediaKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
