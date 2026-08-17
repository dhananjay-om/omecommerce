'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { requestBannerImageUpload } from './actions';
import type { BannerGroup } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { FileUploadButton } from '@/components/ui/file-upload-button';

/** Direct-to-storage upload — same pattern as
 *  categories/category-image-upload-field.tsx. Deliberately does NOT
 *  confirm/persist on its own: it just fills a hidden `imageMediaKey`
 *  input on the parent form, so a new image only takes effect once the
 *  admin clicks Create/Save Banner along with everything else on the form. */
export function BannerImageUploadField({
  group,
  initialImageUrl,
  initialImageMediaKey,
}: {
  group: BannerGroup;
  initialImageUrl: string | null;
  initialImageMediaKey: string | null;
}) {
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
      const presign = await requestBannerImageUpload(group, file.name, file.type);
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
      <Label htmlFor="banner-image">Image</Label>
      <input type="hidden" name="imageMediaKey" value={imageMediaKey} />
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL (or a local object URL right after upload), both per-request/dynamic
            <img src={previewUrl} alt="Banner" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="space-y-1.5">
          <FileUploadButton
            id="banner-image"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            label={uploading ? 'Uploading…' : previewUrl ? 'Change Image' : 'Choose Image'}
          />
          <p className="text-xs text-muted-foreground">Uploads immediately; takes effect once you save below.</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
