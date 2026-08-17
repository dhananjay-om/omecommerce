'use client';

import { useState } from 'react';
import { requestLogoUpload } from './actions';
import { Label } from '@/components/ui/label';

/**
 * Direct-to-storage upload (step 1-2 of the same pattern
 * products/[id]/edit/image-upload-field.tsx uses: presign a PUT URL, browser
 * PUTs straight to S3/MinIO, never proxied through this server) — simplified
 * since a logo has no gallery/MediaAsset row to manage. Deliberately does
 * NOT confirm/persist on its own: it just fills a hidden `logoMediaKey`
 * input on the parent GST Settings form, so the new logo only actually takes
 * effect when the admin clicks "Save GST Settings" along with everything
 * else on that page — consistent with every other field there.
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
      <Label htmlFor={`gst-logo-${code}`}>Store Logo</Label>
      <input type="hidden" name="logoMediaKey" value={logoMediaKey} />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL (or a local object URL right after upload), both per-request/dynamic
        <img src={previewUrl} alt="Store logo" className="h-16 w-auto rounded-md border object-contain p-1" />
      ) : null}
      <input id={`gst-logo-${code}`} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="text-sm" />
      {uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Shown on the invoice letterhead. Uploads immediately; takes effect once you Save below.</p>
    </div>
  );
}
