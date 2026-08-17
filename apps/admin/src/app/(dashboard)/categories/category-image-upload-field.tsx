'use client';

import { useState } from 'react';
import { requestCategoryImageUpload } from './actions';
import { Label } from '@/components/ui/label';

/**
 * Direct-to-storage upload (same presign-PUT pattern as
 * stores/general/logo-upload-field.tsx and products/[id]/edit/image-upload-field.tsx)
 * — simplified since a category image has no gallery/MediaAsset row to manage.
 * Deliberately does NOT confirm/persist on its own: it just fills a hidden
 * `imageMediaKey` input on the parent edit form, so a new image only takes
 * effect once the admin clicks Save along with everything else on the page.
 *
 * The hidden field starts at the category's *current* key (not ''), so
 * saving the form without touching the file input keeps the existing image
 * instead of clearing it.
 */
export function CategoryImageUploadField({ publicId, initialImageUrl, initialImageMediaKey }: { publicId: string; initialImageUrl: string | null; initialImageMediaKey: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [imageMediaKey, setImageMediaKey] = useState(initialImageMediaKey ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const presign = await requestCategoryImageUpload(publicId, file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.imageMediaKey) {
        setError(presign.error ?? 'Could not start upload.');
        return;
      }
      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) {
        setError('Upload to storage failed.');
        return;
      }
      setImageMediaKey(presign.imageMediaKey);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`cat-image-${publicId}`}>Category Image</Label>
      <input type="hidden" name="imageMediaKey" value={imageMediaKey} />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL (or a local object URL right after upload), both per-request/dynamic
        <img src={previewUrl} alt="Category" className="h-24 w-auto rounded-md border object-contain p-1" />
      ) : null}
      <input id={`cat-image-${publicId}`} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="text-sm" />
      {uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Shown on the category&apos;s storefront listing page. Uploads immediately; takes effect once you Save below.</p>
    </div>
  );
}
