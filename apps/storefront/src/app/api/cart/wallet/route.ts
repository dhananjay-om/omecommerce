import { NextResponse } from 'next/server';
import { ensureCart } from '@/lib/cart-server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId, getSession } from '@/lib/session';
import type { Cart } from '@/types/cart';

/** Applies the signed-in customer's wallet as a tender — requireCustomer + ownership-checked server-side (the backend resolves identity from the forwarded bearer token, no separate /me round-trip needed here). */
export async function POST() {
  const token = await getSession();
  if (!token) return NextResponse.json({ error: 'Sign in to pay with your wallet.' }, { status: 401 });

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/apply-wallet`, {}, { auth: true });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE() {
  const token = await getSession();
  if (!token) return NextResponse.json({ error: 'Sign in to manage your wallet tender.' }, { status: 401 });

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/remove-wallet`, {}, { auth: true });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
