import { Star } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import type { ProductDetail, ProductReview } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReviewSummary } from './review-summary';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Real (minimal) review reads — see ProductReview's own schema doc comment
 * for why this is deliberately small: no submission flow, no moderation,
 * just enough real customer text for the AI Summary above to read from.
 */
export default async function ProductReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, reviews] = await Promise.all([
    apiGet<ProductDetail>(`/admin/v1/products/${id}`),
    apiGet<ProductReview[]>(`/admin/v1/products/${id}/reviews`),
  ]);
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <div className="space-y-4">
      <ReviewSummary
        productPublicId={product.publicId}
        context={{ title: product.name ?? '', sku: product.sku, productType: product.type, tags: product.tags }}
        hasReviews={reviews.length > 0}
      />

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No reviews yet for this product.</CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {reviews.length} review{reviews.length === 1 ? '' : 's'} · {avgRating!.toFixed(1)} average rating
          </p>
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.publicId}>
                <CardContent className="space-y-1.5 pt-4">
                  <div className="flex items-center justify-between">
                    <StarRating rating={r.rating} />
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.title ? <p className="text-sm font-semibold text-foreground">{r.title}</p> : null}
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                  <p className="text-xs font-medium text-foreground">— {r.customerName}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
