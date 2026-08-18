'use server';

import { apiPost, ApiError } from '@/lib/api-client';

export interface CmsImageUploadUrlResult {
  error: string | null;
  uploadUrl?: string;
  imageMediaKey?: string;
}

/**
 * Step 1 of the rich text editor's inline-image upload flow (own copy of
 * the same presign-PUT pattern as categories/banners' image fields) —
 * shared between Content > Pages and Content > Blocks since both use the
 * same RichTextEditor component. Mints a presigned PUT URL the browser
 * uploads straight to; the returned imageMediaKey gets embedded as a
 * `data-media-key` attribute on the inserted <img>, never the raw URL
 * itself (see the backend's resolve-inline-images.ts for why).
 */
export async function requestCmsImageUpload(filename: string, mimeType: string): Promise<CmsImageUploadUrlResult> {
  try {
    const res = await apiPost<{ uploadUrl: string; imageMediaKey: string }>('/admin/v1/cms/image-upload-url', { filename, mimeType });
    return { error: null, uploadUrl: res.uploadUrl, imageMediaKey: res.imageMediaKey };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    throw err;
  }
}
