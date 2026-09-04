import { NextResponse } from 'next/server';
import { apiDelete, ApiError } from '@/lib/api-client';
import { ensureWishlist } from '@/lib/wishlist-server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  try {
    const wishlist = await ensureWishlist();
    await apiDelete(`/store/v1/me/wishlists/${wishlist.publicId}/items/${productId}`, { auth: true });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
