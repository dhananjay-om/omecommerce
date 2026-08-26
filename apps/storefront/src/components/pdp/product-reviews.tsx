'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'sonner';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { ProductReviewList } from '@/types/review';

function StarRow({ rating, size = 'size-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= rating ? (
          <StarIcon key={n} className={cn(size, 'text-cta')} />
        ) : (
          <StarOutlineIcon key={n} className={cn(size, 'text-muted-foreground/40')} />
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
          {n <= value ? <StarIcon className="size-6 text-cta" /> : <StarOutlineIcon className="size-6 text-muted-foreground/40" />}
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
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/reviews`, { rating, title: title.trim() || null, body: body.trim() });
      setSubmitted(true);
      setShowForm(false);
      setRating(0);
      setTitle('');
      setBody('');
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
            <span className="text-3xl font-bold">{data.averageRating!.toFixed(1)}</span>
            <StarRow rating={Math.round(data.averageRating!)} />
            <span className="text-xs text-muted-foreground">
              {data.total} review{data.total === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = data.ratingBreakdown[n as 1 | 2 | 3 | 4 | 5];
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground">{n}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-cta" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No reviews yet. Be the first to review this product.</p>
      )}

      {isLoggedIn ? (
        submitted ? (
          <p className="text-sm text-muted-foreground">Thanks for your review — it&apos;ll appear here once approved.</p>
        ) : showForm ? (
          <form onSubmit={submitReview} className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="mb-1 text-sm font-medium">Your rating</p>
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
            {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Review'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Write a Review
          </Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>{' '}
          to write a review.
        </p>
      )}

      {data.reviews.length > 0 ? (
        <div className="space-y-4">
          {data.reviews.map((r) => (
            <div key={r.publicId} className="border-b pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <StarRow rating={r.rating} />
                <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
              </div>
              {r.title ? <p className="mt-1 text-sm font-semibold">{r.title}</p> : null}
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              <p className="mt-1 text-xs font-medium">— {r.customerName}</p>
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
