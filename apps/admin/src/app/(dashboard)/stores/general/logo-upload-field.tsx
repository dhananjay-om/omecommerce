'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { requestLogoUpload } from './actions';
import { Label } from '@/components/ui/label';
import { FileUploadButton } from '@/components/ui/file-upload-button';

/**
 * Direct-to-storage upload (step 1-2 of the same pattern
 * products/[id]/edit/image-upload-field.tsx uses: presign a PUT URL, browser
 * PUTs straight to S3/MinIO, never proxied through this server) — simplified
 * since a logo has no gallery/MediaAsset row to manage. Deliberately does
 * NOT confirm/persist on its own: it just fills a hidden `logoMediaKey`
 * input on the parent General Settings form, so the new logo only actually
 * takes effect when the admin clicks "Save General Settings" along with
 * everything else on that page — consistent with every other field there.
 */
export function LogoUploadField({ code, initialLogoUrl }: { code: string; initialLogoUrl: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialLogoUrl);
  const [logoMediaKey, setLogoMediaKey] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const presign = await requestLogoUpload(code, file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.logoMediaKey) {
        setError(presign.error ?? 'Could not start upload.');
        return;
      }
      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) {
        setError('Upload to storage failed.');
        return;
      }
      setLogoMediaKey(presign.logoMediaKey);
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`general-logo-${code}`}>Store Logo</Label>
      <input type="hidden" name="logoMediaKey" value={logoMediaKey} />
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL (or a local object URL right after upload), both per-request/dynamic
            <img src={previewUrl} alt="Store logo" className="size-full object-contain p-1" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground/50" />
          )}
        </div>
        <div className="space-y-1.5">
          <FileUploadButton
            id={`general-logo-${code}`}
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            label={uploading ? 'Uploading…' : previewUrl ? 'Change Logo' : 'Choose Logo'}
          />
          <p className="text-xs text-muted-foreground">Shown on the invoice letterhead. Uploads immediately; takes effect once you Save below.</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
