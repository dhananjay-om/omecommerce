import { NextResponse } from 'next/server';
import { apiGet, apiPost, buildQuery, ApiError } from '@/lib/api-client';
import type { ProductReviewList } from '@/types/review';

/** GET is public (approved-only, paginated) — used by ProductReviews' own
 *  client-side pagination past the server-rendered first page. POST requires
 *  a logged-in customer (same auth:true convention as /api/wishlist). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  try {
    const result = await apiGet<ProductReviewList>(
      `/store/v1/products/${id}/reviews${buildQuery({
        page: url.searchParams.get('page') ?? undefined,
        pageSize: url.searchParams.get('pageSize') ?? undefined,
      })}`,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rating = typeof body?.rating === 'number' ? body.rating : null;
  const reviewBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!rating || rating < 1 || rating > 5 || !reviewBody) {
    return NextResponse.json({ error: 'A star rating and review text are required.' }, { status: 400 });
  }
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : null;
  const imageKeys = Array.isArray(body?.imageKeys) ? body.imageKeys.filter((k: unknown) => typeof k === 'string' && k.length > 0) : [];

  try {
    const review = await apiPost(`/store/v1/products/${id}/reviews`, { rating, title, body: reviewBody, imageKeys }, { auth: true });
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
