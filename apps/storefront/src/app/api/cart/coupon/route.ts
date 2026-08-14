import { NextResponse } from 'next/server';
import { ensureCart } from '@/lib/cart-server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId } from '@/lib/session';
import type { Cart } from '@/types/cart';

/** Applies a coupon code to the current cart. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'A coupon code is required.' }, { status: 400 });
  }

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/apply-coupon`, { code });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/** Removes whatever coupon is currently applied. */
export async function DELETE() {
  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/remove-coupon`, {});
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
