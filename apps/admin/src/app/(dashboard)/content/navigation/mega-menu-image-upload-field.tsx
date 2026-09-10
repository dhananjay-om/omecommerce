'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { requestMegaMenuImageUpload } from './actions';
import { Label } from '@/components/ui/label';
import { FileUploadButton } from '@/components/ui/file-upload-button';

/** Direct-to-storage upload — same pattern as banners/banner-image-
 *  upload-field.tsx, just controlled (calls back into the parent form's
 *  own state) instead of writing a hidden FormData input, since the rest
 *  of this form isn't FormData-based (the nested columns/links structure
 *  doesn't encode cleanly into plain form fields the way a banner's flat
 *  fields do — see mega-menu-item-form.tsx's own doc comment). */
export function MegaMenuImageUploadField({
  imageUrl,
  onChange,
}: {
  imageUrl: string | null;
  onChange: (imageMediaKey: string, previewUrl: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const presign = await requestMegaMenuImageUpload(file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.imageMediaKey) {
        setError(presign.error ?? 'Could not start upload.');
        return;
      }
      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) {
        setError('Upload to storage failed.');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      onChange(presign.imageMediaKey, objectUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="mega-menu-promo-image">Promo image (optional)</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL (or a local object URL right after upload), both per-request/dynamic
            <img src={previewUrl} alt="Promo" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="space-y-1.5">
          <FileUploadButton
            id="mega-menu-promo-image"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            label={uploading ? 'Uploading…' : previewUrl ? 'Change Image' : 'Choose Image'}
          />
          <p className="text-xs text-muted-foreground">Shown in the dropdown panel next to this item&apos;s columns.</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
