import { NextResponse } from 'next/server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId } from '@/lib/session';

/**
 * Proxies checkout to the existing (test-payment-gateway-backed) endpoint.
 * The full multi-step checkout UI and real Idempotency-Key handling are
 * Phase 7's job — this is a minimal working proxy so the service layer is
 * complete now.
 */
export async function POST(request: Request) {
  const cartId = await getCartId();
  if (!cartId) return NextResponse.json({ error: 'No cart.' }, { status: 400 });

  const body = await request.json().catch(() => null);
  try {
    const order = await apiPost(`/store/v1/carts/${cartId}/checkout`, body);
    return NextResponse.json(order);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
