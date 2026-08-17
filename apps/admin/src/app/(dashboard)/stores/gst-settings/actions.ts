'use server';

import { revalidatePath } from 'next/cache';
import { apiPatch, apiPost, ApiError } from '@/lib/api-client';
import type { Website } from '@/lib/types';

export interface ActionState {
  error: string | null;
  success: boolean;
}

export async function updateGstSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get('code') ?? '').trim();
  const gstin = String(formData.get('gstin') ?? '').trim().toUpperCase();
  const originStateCode = String(formData.get('originStateCode') ?? '').trim();
  const pricesIncludeTax = String(formData.get('pricesIncludeTax') ?? 'false') === 'true';
  const address = String(formData.get('address') ?? '').trim();
  const logoMediaKey = String(formData.get('logoMediaKey') ?? '').trim();

  if (!code) return { error: 'Missing website code.', success: false };
  // Both-or-neither — same pairing the backend's CHECK constraint enforces.
  if (!!gstin !== !!originStateCode) {
    return { error: 'GSTIN and origin state must be set together (or both left blank).', success: false };
  }

  try {
    await apiPatch<Website>(`/admin/v1/websites/${code}/tax-settings`, {
      gstin: gstin || null,
      originStateCode: originStateCode || null,
      pricesIncludeTax,
      address: address || null,
      logoMediaKey: logoMediaKey || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, success: false };
    throw err;
  }

  revalidatePath('/stores/gst-settings');
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
 *  of this form's fields on "Save GST Settings", not confirmed separately. */
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
