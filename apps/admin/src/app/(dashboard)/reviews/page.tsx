import Link from 'next/link';
import { Star } from 'lucide-react';
import { apiGet, buildQuery } from '@/lib/api-client';
import type { PaginatedAdminReviews } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { ReviewModerationActions } from '@/components/reviews/review-moderation-actions';
import { ReviewImages } from '@/components/reviews/review-images';

const PAGE_SIZE = 20;

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

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
] as const;

/**
 * Cross-product moderation queue (Commerce > Reviews) — every review across
 * every product in one place, so approving/rejecting doesn't require
 * hunting down which product a review belongs to first. The per-product
 * Reviews tab (products/[id]/reviews) still exists for a product-scoped
 * view; both moderate through the same shared action.
 */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const isApproved = params.status === 'pending' ? false : params.status === 'approved' ? true : undefined;

  const list = await apiGet<PaginatedAdminReviews>(`/admin/v1/reviews${buildQuery({ isApproved, page, pageSize: PAGE_SIZE })}`);
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div>
      <PageBreadcrumb items={[{ label: 'Commerce', href: '/reviews' }, { label: 'Reviews' }]} />

      <div className="mt-2">
        <h1 className="text-[1.32rem] font-extrabold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every customer review across every product. A review only shows on the storefront once approved here.{' '}
          {list.total} review{list.total === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="mt-6 flex gap-2">
        {STATUS_TABS.map((tab) => {
          const active = (params.status ?? undefined) === tab.key;
          const href = `/reviews${buildQuery({ status: tab.key })}`;
          return (
            <Link key={tab.label} href={href} className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }))}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {list.reviews.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No reviews match this filter.</CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {list.reviews.map((r) => (
            <Card key={r.publicId}>
              <CardContent className="space-y-1.5 pt-4">
                <div className="flex items-center justify-between">
                  <Link href={`/products/${r.productPublicId}/reviews`} className="text-sm font-medium text-primary hover:underline">
                    {r.productName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                <StarRating rating={r.rating} />
                {r.title ? <p className="text-sm font-semibold text-foreground">{r.title}</p> : null}
                <p className="text-sm text-muted-foreground">{r.body}</p>
                <ReviewImages images={r.images} />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">— {r.customerName}</p>
                  <ReviewModerationActions productId={r.productPublicId} reviewId={r.publicId} isApproved={r.isApproved} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {list.reviews.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + list.reviews.length} of {list.total}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={`/reviews${buildQuery({ status: params.status, page: page - 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Previous
            </Link>
          )}
          <span className="px-1">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={`/reviews${buildQuery({ status: params.status, page: page + 1 })}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
