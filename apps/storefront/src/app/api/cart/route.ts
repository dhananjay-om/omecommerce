import { NextResponse } from 'next/server';
import { ensureCart } from '@/lib/cart-server';
import { apiPost, ApiError } from '@/lib/api-client';
import { getCartId } from '@/lib/session';
import type { Cart } from '@/types/cart';

/** Reads (creating if needed) the current cart — used by the header's mini-cart and the cartStore's hydration on mount. */
export async function GET() {
  const cart = await ensureCart();
  return NextResponse.json(cart);
}

/** Adds a line, or overwrites its qty if the variant is already in the cart (the backend's upsert semantics). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const variantId = typeof body?.variantId === 'string' ? body.variantId : '';
  const qty = typeof body?.qty === 'number' ? body.qty : 0;
  if (!variantId || qty <= 0) {
    return NextResponse.json({ error: 'variantId and a positive qty are required.' }, { status: 400 });
  }

  await ensureCart();
  const cartId = await getCartId();
  try {
    const cart = await apiPost<Cart>(`/store/v1/carts/${cartId}/lines`, { variantId, qty });
    return NextResponse.json(cart);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
