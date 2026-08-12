import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { ensureWishlist } from '@/lib/wishlist-server';

export async function GET() {
  const wishlist = await ensureWishlist();
  return NextResponse.json(wishlist);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'productId is required.' }, { status: 400 });

  const wishlist = await ensureWishlist();
  try {
    await apiPost(`/store/v1/me/wishlists/${wishlist.publicId}/items`, { productId }, { auth: true });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
