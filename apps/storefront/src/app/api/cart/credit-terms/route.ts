import { NextResponse } from 'next/server';
import { ensureCart } from '@/lib/cart-server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId, getSession } from '@/lib/session';
import type { Cart } from '@/types/cart';

/** Applies "pay on account" (B2B Net-X credit terms, plan/15 Phase 7) as a tender — requireCustomer + ownership-checked server-side, same shape as the wallet route. Eligibility (an active company membership with an active credit account and available limit) isn't checked here — the backend resolves it and EnrichCartView surfaces any ineligibility as a tenderError on the next cart read. */
export async function POST() {
  const token = await getSession();
  if (!token) return NextResponse.json({ error: 'Sign in to pay on account.' }, { status: 401 });

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/apply-credit-terms`, {}, { auth: true });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE() {
  const token = await getSession();
  if (!token) return NextResponse.json({ error: 'Sign in to manage your account terms.' }, { status: 401 });

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/actions/remove-credit-terms`, {}, { auth: true });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
