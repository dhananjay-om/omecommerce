'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';
import type { Website } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateGeneralSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const logoMediaKey = String(formData.get('logoMediaKey') ?? '').trim();
  const supportEmail = String(formData.get('supportEmail') ?? '').trim();

  if (!code) return { error: 'Missing website code.', success: false };

  try {
    await apiPatch<Website>(`/admin/v1/websites/${code}/general-settings`, {
      address: address || null,
      logoMediaKey: logoMediaKey || null,
      supportEmail: supportEmail || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/general');
  return { error: null, success: true };
}

export interface LogoUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  logoMediaKey?: string;
}

/** Step 1 of the logo upload's direct-to-storage flow (same pattern as
 *  product image upload) — mints a presigned PUT URL the browser then uploads
 *  straight to, never proxied through this server. The returned logoMediaKey
 *  isn't persisted onto the website yet; it's submitted along with the rest
 *  of this form's fields on "Save General Settings", not confirmed separately. */
export async function requestLogoUpload(code: string, filename: string, mimeType: string): Promise<LogoUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; logoMediaKey: string }>(`/admin/v1/websites/${code}/logo-upload-url`, {
      filename,
      mimeType,
    });
    return { error: null, uploadUrl: res.uploadUrl, logoMediaKey: res.logoMediaKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
