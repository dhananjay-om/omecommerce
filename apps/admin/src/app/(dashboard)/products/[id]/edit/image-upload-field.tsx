'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Sparkles } from 'lucide-react';
import type { ProductMedia } from '@/lib/types';
import { requestUploadUrl, confirmMediaUpload, detachMedia, setThumbnail, updateMediaAltText } from './media-actions';
import { generateAltText, type ProductAiContext } from '../ai-product-assistant-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { cn } from '@/lib/utils';

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

/**
 * Direct-to-storage upload widget (plan/13 Phase J), extended with a
 * "Set as Main" action — exactly one image can hold role=THUMBNAIL at a
 * time, and that's the image every storefront surface that shows only one
 * picture (collection/PLP grid, search hits, mini-cart, cart line) resolves
 * to, plus the admin grid's own thumbnail column. Images need an existing
 * product to attach to, so this only appears on the edit page, not create.
 */
export function ImageUploadField({
  productPublicId,
  media,
  aiContext,
}: {
  productPublicId: string;
  media: ProductMedia[];
  /** Minimal real product context for alt-text generation grounding —
   *  see products/[id]/media/page.tsx's own call site. */
  aiContext: ProductAiContext;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'delete' | 'thumbnail' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      // Sequential, not Promise.all — each upload appends at (current max
      // position + 1), read fresh from the DB per attach, so parallel
      // uploads could race and land on the same position.
      for (const file of files) {
        const presign = await requestUploadUrl(file.name, file.type);
        if (presign.error || !presign.uploadUrl || !presign.storageKey) {
          setError(presign.error ?? 'Could not start upload.');
          continue;
        }

        const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!putRes.ok) {
          setError('Upload to storage failed.');
          continue;
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
        }
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(productMediaId: string) {
    setError(null);
    setPendingId(productMediaId);
    setPendingAction('delete');
    startTransition(async () => {
      const result = await detachMedia(productPublicId, productMediaId);
      setPendingId(null);
      setPendingAction(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSetThumbnail(productMediaId: string) {
    setError(null);
    setPendingId(productMediaId);
    setPendingAction('thumbnail');
    startTransition(async () => {
      const result = await setThumbnail(productPublicId, productMediaId);
      setPendingId(null);
      setPendingAction(null);
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
      <p className="text-xs text-muted-foreground">
        Upload one or more images. The main image is used as the thumbnail on the collection page, product page, mini-cart, and cart.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {media.length > 0 ? (
        <div className="grid grid-cols-4 gap-3">
          {media.map((m) => {
            const isThumbnail = m.role === 'THUMBNAIL';
            const busy = isPending && pendingId === m.productMediaId;
            return (
              <div key={m.productMediaId} className="space-y-1">
                <div className={cn('group relative overflow-hidden rounded-md border-2', isThumbnail ? 'border-primary' : 'border-transparent')}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic; next/image's remote-pattern allowlist doesn't fit this */}
                  <img src={m.url} alt={m.altText ?? ''} className="aspect-square w-full object-cover" />
                  {isThumbnail ? (
                    <Badge className="absolute top-1 left-1 gap-1">
                      <Star className="size-3 fill-current" /> Main
                    </Badge>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isThumbnail ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        disabled={busy}
                        onClick={() => handleSetThumbnail(m.productMediaId)}
                      >
                        {busy && pendingAction === 'thumbnail' ? '…' : 'Set as Main'}
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      disabled={busy}
                      onClick={() => handleDelete(m.productMediaId)}
                    >
                      {busy && pendingAction === 'delete' ? '…' : 'Delete'}
                    </Button>
                  </div>
                </div>
                <AltTextRow productPublicId={productPublicId} media={m} aiContext={aiContext} />
              </div>
            );
          })}
        </div>
      ) : null}
      <FileUploadButton
        accept="image/*"
        multiple
        onChange={handleFileChange}
        disabled={uploading}
        label={uploading ? 'Uploading…' : 'Add Images'}
      />
    </div>
  );
}

/** Per-image alt-text editor — the manual input and the AI "Generate"
 *  button both save through the same updateMediaAltText action (see its
 *  own doc comment). Auto-saves on blur, same low-friction posture as
 *  every other inline-editable field in this admin, rather than a
 *  separate visible Save button. */
function AltTextRow({ productPublicId, media, aiContext }: { productPublicId: string; media: ProductMedia; aiContext: ProductAiContext }) {
  const [value, setValue] = useState(media.altText ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(media.altText ?? '');

  async function save(next: string) {
    if (next === savedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateMediaAltText(productPublicId, media.productMediaId, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      savedRef.current = next;
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAltText(productPublicId, media.productMediaId, aiContext);
      if (result.error || !result.data) {
        setError(result.error ?? 'Generation failed.');
        return;
      }
      setValue(result.data.altText);
      await save(result.data.altText);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value)}
          placeholder="Alt text…"
          className="h-7 text-xs"
          disabled={saving}
        />
        <Button type="button" variant="ghost" size="icon-sm" title="Generate alt text with AI" disabled={generating} onClick={handleGenerate}>
          <Sparkles className={cn('size-3', generating && 'animate-pulse')} />
        </Button>
      </div>
      {error ? <p className="text-[0.65rem] text-destructive">{error}</p> : null}
    </div>
  );
}
