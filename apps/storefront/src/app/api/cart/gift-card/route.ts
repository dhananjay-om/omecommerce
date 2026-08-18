import { NextResponse } from 'next/server';
import { ensureCart } from '@/lib/cart-server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId } from '@/lib/session';
import type { Cart } from '@/types/cart';

/** Applies a gift card code to the current cart — unauthenticated, bearer-code trust, same shape as api/cart/coupon/route.ts. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'A gift card code is required.' }, { status: 400 });
  }

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/apply-gift-card`, { code });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/** Removes one specific applied gift card by its publicId — a cart can carry
 *  several, and unlike apply, removal needs no bearer-code proof (see
 *  RemoveGiftCardFromCart's doc comment). */
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const giftCardPublicId = typeof body?.giftCardPublicId === 'string' ? body.giftCardPublicId : '';
  if (!giftCardPublicId) {
    return NextResponse.json({ error: 'A gift card id is required.' }, { status: 400 });
  }

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/remove-gift-card`, { giftCardPublicId });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
