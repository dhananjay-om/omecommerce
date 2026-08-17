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
    if (err instanceof ApiError) {
      // err.message is the RFC7807 `title`, which for a Zod-schema validation
      // failure is always the generic "Validation failed" — the actually
      // useful, field-specific reason (e.g. "expected a valid 15-character
      // GSTIN") lives in `errors[]` instead. Prefer that when present so the
      // customer sees what's actually wrong, not a dead-end generic message.
      const message = err.errors?.[0]?.message ?? err.message;
      return NextResponse.json({ error: message }, { status: err.status });
    }
    throw err;
  }
}
