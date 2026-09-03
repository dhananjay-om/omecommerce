'use client';

import { useState, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'sonner';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon, XMarkIcon, CameraIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ProductReviewList } from '@/types/review';

const MAX_PHOTOS = 5;

interface PendingPhoto {
  id: string;
  previewUrl: string;
  storageKey: string | null;
  uploading: boolean;
  error: string | null;
}

/**
 * Uploads straight to storage the same way the admin's product-image
 * uploader does (presign a PUT, then PUT the bytes directly) — this server
 * never sees the raw file. Returns the storage key on success; the caller
 * updates its own state.
 */
async function uploadReviewPhoto(file: File): Promise<{ storageKey: string } | { error: string }> {
  try {
    const { data: presign } = await api.post<{ uploadUrl: string; storageKey: string }>('/reviews/uploads', {
      filename: file.name,
      mimeType: file.type,
    });
    const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!putRes.ok) return { error: 'Upload failed.' };
    return { storageKey: presign.storageKey };
  } catch (err) {
    const message = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : null;
    return { error: message ?? 'Upload failed.' };
  }
}

function PhotoPicker({ photos, setPhotos }: { photos: PendingPhoto[]; setPhotos: React.Dispatch<React.SetStateAction<PendingPhoto[]>> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const selected = Array.from(files).slice(0, room);

    const drafts: PendingPhoto[] = selected.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      previewUrl: URL.createObjectURL(file),
      storageKey: null,
      uploading: true,
      error: null,
    }));
    setPhotos((prev) => [...prev, ...drafts]);

    await Promise.all(
      selected.map(async (file, i) => {
        const draft = drafts[i];
        const result = await uploadReviewPhoto(file);
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === draft.id
              ? 'error' in result
                ? { ...p, uploading: false, error: result.error }
                : { ...p, uploading: false, storageKey: result.storageKey }
              : p,
          ),
        );
      }),
    );
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Add photos (optional)</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative size-16">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview URL, not a remote asset next/image can optimize */}
            <img src={p.previewUrl} alt="" className={cn('size-16 rounded-md border object-cover', p.uploading && 'opacity-50')} />
            {p.uploading ? (
              <span className="absolute inset-0 flex items-center justify-center text-[0.6rem] text-white">…</span>
            ) : (
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
              >
                <XMarkIcon className="size-3" />
              </button>
            )}
            {p.error ? <span className="absolute inset-x-0 -bottom-4 text-center text-[0.6rem] text-destructive">Failed</span> : null}
          </div>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            <CameraIcon className="size-5" />
            <span className="text-[0.6rem]">Add</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function StarRow({ rating, size = 'size-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= rating ? (
          <StarIcon key={n} className={cn(size, 'text-champagne')} />
        ) : (
          <StarOutlineIcon key={n} className={cn(size, 'text-silver')} />
        ),
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>
          {n <= value ? <StarIcon className="size-6 text-champagne" /> : <StarOutlineIcon className="size-6 text-silver" />}
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Real customer submission + moderation — see ProductReview's own schema doc
 * comment for the upgrade from the original AI-summarization-only pass. The
 * first page is server-rendered (initialReviews, for SEO/no-JS baseline);
 * pagination past that and submission both go through the same-origin /api
 * proxy (lib/axios's `api`), since neither can carry the httpOnly session
 * cookie's token itself.
 */
export function ProductReviews({ productId, initialReviews }: { productId: string; initialReviews: ProductReviewList }) {
  const [data, setData] = useState(initialReviews);
  const [page, setPage] = useState(initialReviews.page);
  const [loading, setLoading] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function loadPage(nextPage: number) {
    setLoading(true);
    try {
      const { data: result } = await api.get<ProductReviewList>(`/products/${productId}/reviews`, { params: { page: nextPage } });
      setData(result);
      setPage(nextPage);
    } catch {
      toast.error('Could not load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setSubmitError('Please pick a star rating.');
      return;
    }
    if (!body.trim()) {
      setSubmitError('Please write a review before submitting.');
      return;
    }
    if (photos.some((p) => p.uploading)) {
      setSubmitError('Please wait for your photos to finish uploading.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const imageKeys = photos.map((p) => p.storageKey).filter((k): k is string => k !== null);
      await api.post(`/products/${productId}/reviews`, { rating, title: title.trim() || null, body: body.trim(), imageKeys });
      setSubmitted(true);
      setShowForm(false);
      setRating(0);
      setTitle('');
      setBody('');
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
      toast.success("Thanks! Your review will show once it's approved.");
    } catch (err) {
      const message = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : null;
      setSubmitError(message ?? 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const maxCount = Math.max(1, ...[5, 4, 3, 2, 1].map((n) => data.ratingBreakdown[n as 1 | 2 | 3 | 4 | 5]));

  return (
    <div className="space-y-6">
      {data.total > 0 ? (
        // max-w-md — this section now spans the full page width (moved out of the
        // narrower two-column layout), and the breakdown bars used flex-1 to fill
        // whatever space they're given. Left unconstrained, that meant stretching
        // across nearly the entire page, which read as an odd, oversized bar. Capping
        // the whole summary block keeps it a normal, compact size regardless of the
        // section's own width.
        <div className="flex max-w-md flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
            <span className="text-3xl font-bold text-jet">{data.averageRating!.toFixed(1)}</span>
            <StarRow rating={Math.round(data.averageRating!)} />
            <span className="text-xs text-slate">
              {data.total} review{data.total === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = data.ratingBreakdown[n as 1 | 2 | 3 | 4 | 5];
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-slate">{n}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-ghost">
                    <div className="h-1.5 rounded-full bg-champagne" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-slate">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-slate">No reviews yet. Be the first to review this product.</p>
      )}

      {isLoggedIn ? (
        submitted ? (
          <p className="text-sm text-slate">Thanks for your review — it&apos;ll appear here once approved.</p>
        ) : showForm ? (
          <form onSubmit={submitReview} className="space-y-3 rounded-2xl border border-ghost p-4">
            <div>
              <p className="mb-1 text-sm font-medium text-jet">Your rating</p>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
            <Textarea
              placeholder="Share your thoughts about this product…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={5000}
            />
            <PhotoPicker photos={photos} setPhotos={setPhotos} />
            {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting || photos.some((p) => p.uploading)}>
                {submitting ? 'Submitting…' : 'Submit Review'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="cta" size="sm" onClick={() => setShowForm(true)}>
            <PencilSquareIcon className="size-4" />
            Write a Review
          </Button>
        )
      ) : (
        <p className="text-sm text-slate">
          <Link href="/login" className="text-champagne hover:text-jet">
            Log in
          </Link>{' '}
          to write a review.
        </p>
      )}

      {data.reviews.length > 0 ? (
        <div className="space-y-4">
          {data.reviews.map((r) => (
            <div key={r.publicId} className="border-b border-ghost pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <StarRow rating={r.rating} />
                <span className="text-xs text-slate">{formatDate(r.createdAt)}</span>
              </div>
              {r.title ? <p className="mt-1 text-sm font-semibold text-jet">{r.title}</p> : null}
              <p className="mt-1 text-sm text-charcoal">{r.body}</p>
              {r.images.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.images.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic; next/image's remote-pattern allowlist doesn't fit this */}
                      <img src={url} alt={`Photo ${i + 1} from ${r.customerName}'s review`} className="size-16 rounded-lg border border-ghost object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-xs font-medium text-slate">— {r.customerName}</p>
            </div>
          ))}
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => loadPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => loadPage(page + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
