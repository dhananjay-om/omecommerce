import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { ensureWishlist } from '@/lib/wishlist-server';

export async function GET() {
  try {
    const wishlist = await ensureWishlist();
    return NextResponse.json(wishlist);
  } catch (err) {
    // A guest (no/invalid session) hitting this directly used to crash
    // unhandled instead of a clean 401 — `useWishlistStore.hydrate()` now
    // gates its own call behind `isLoggedIn`, but this route itself should
    // still fail cleanly for any other caller.
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'productId is required.' }, { status: 400 });

  try {
    const wishlist = await ensureWishlist();
    await apiPost(`/store/v1/me/wishlists/${wishlist.publicId}/items`, { productId }, { auth: true });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
