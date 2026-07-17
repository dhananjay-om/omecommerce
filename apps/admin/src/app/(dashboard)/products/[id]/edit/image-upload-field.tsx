'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductMedia } from '@/lib/types';
import { requestUploadUrl, confirmMediaUpload, detachMedia } from './media-actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('failed to read image dimensions'));
    };
    img.src = url;
  });
}

/** Direct-to-storage upload widget (plan/13 Phase J) — images need an existing
 * product to attach to, so this only appears on the edit page, not create. */
export function ImageUploadField({ productPublicId, media }: { productPublicId: string; media: ProductMedia[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const presign = await requestUploadUrl(file.name, file.type);
      if (presign.error || !presign.uploadUrl || !presign.storageKey) {
        setError(presign.error ?? 'Could not start upload.');
        return;
      }

      const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) {
        setError('Upload to storage failed.');
        return;
      }

      const dimensions = await readImageDimensions(file).catch(() => null);
      const confirmed = await confirmMediaUpload(
        productPublicId,
        presign.storageKey,
        file.type,
        file.size,
        dimensions?.width,
        dimensions?.height,
      );
      if (confirmed.error) {
        setError(confirmed.error);
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(productMediaId: string) {
    setError(null);
    setDeletingId(productMediaId);
    startTransition(async () => {
      const result = await detachMedia(productPublicId, productMediaId);
      setDeletingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Label>Images</Label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {media.length > 0 ? (
        <div className="grid grid-cols-4 gap-3">
          {media.map((m) => (
            <div key={m.productMediaId} className="group relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic; next/image's remote-pattern allowlist doesn't fit this */}
              <img src={m.url} alt={m.altText ?? ''} className="aspect-square w-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
                disabled={isPending && deletingId === m.productMediaId}
                onClick={() => handleDelete(m.productMediaId)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="text-sm" />
      {uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
    </div>
  );
}
