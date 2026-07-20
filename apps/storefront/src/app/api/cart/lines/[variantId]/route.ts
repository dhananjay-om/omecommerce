import { NextResponse } from 'next/server';
import { apiDelete, ApiError } from '@/lib/api-client';
import { getCartId } from '@/lib/session';
import type { Cart } from '@/types/cart';

export async function DELETE(_request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  const cartId = await getCartId();
  if (!cartId) return NextResponse.json({ error: 'No cart.' }, { status: 404 });

  try {
    const cart = await apiDelete<Cart>(`/store/v1/carts/${cartId}/lines/${variantId}`);
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
