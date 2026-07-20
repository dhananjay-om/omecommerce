import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId, clearCartId } from '@/lib/session';

/** Proxies checkout to the existing (test-payment-gateway-backed) endpoint, forwarding the client's Idempotency-Key. */
export async function POST(request: Request) {
  const cartId = await getCartId();
  if (!cartId) return NextResponse.json({ error: 'No cart.' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const idempotencyKey = request.headers.get('Idempotency-Key');
  try {
    const order = await apiPost(`/store/v1/carts/${cartId}/checkout`, body, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    // The cart is now CONVERTED — clear its id so the next visit starts a fresh cart (see clearCartId's doc comment).
    await clearCartId();
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
