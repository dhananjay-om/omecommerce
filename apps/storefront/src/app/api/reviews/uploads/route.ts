import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';

/** Step 1 of the direct-to-storage upload flow for a review's own photos
 *  (mirrors the admin's product-media presign-PUT flow) — mints a
 *  short-lived presigned PUT URL the browser uploads bytes to directly,
 *  never through this server. Requires a logged-in customer, same
 *  auth:true convention as /api/wishlist and /api/products/[id]/reviews'
 *  own POST. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const filename = typeof body?.filename === 'string' ? body.filename : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  if (!filename || !mimeType) {
    return NextResponse.json({ error: 'filename and mimeType are required.' }, { status: 400 });
  }

  try {
    const result = await apiPost<{ uploadUrl: string; storageKey: string }>('/store/v1/reviews/uploads', { filename, mimeType }, { auth: true });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
