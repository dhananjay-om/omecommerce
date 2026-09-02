import 'server-only';
import { apiGet, apiPost, ApiError } from './api-client';
import { getCartId, setCartId, getSession } from './session';
import { getSelectedStoreViewId } from './store-context';
import type { Cart } from '@/types/cart';

/**
 * Returns the current cart, creating one (and persisting its id in a cookie)
 * if none exists yet, or if the cookie points at a cart that's since vanished
 * (e.g. dev DB reset). Attaches the logged-in customer's publicId at creation
 * time so the cart shows up in their order history — there's no guest→
 * customer cart merge in the backend, a documented, accepted limitation
 * (plan/14 Phase 1).
 */
export async function ensureCart(): Promise<Cart> {
  const existingId = await getCartId();
  if (existingId) {
    try {
      return await apiGet<Cart>(`/store/v1/carts/${existingId}`);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }

  let customerPublicId: string | undefined;
  const token = await getSession();
  if (token) {
    try {
      const me = await apiGet<{ publicId: string }>('/store/v1/me', { auth: true });
      customerPublicId = me.publicId;
    } catch {
      // Not fatal — worst case the new cart is a guest cart.
    }
  }

  const storeViewId = await getSelectedStoreViewId();
  const cart = await apiPost<Cart>('/store/v1/carts', { storeViewId, customerPublicId });
  try {
    await setCartId(cart.publicId);
  } catch {
    // ensureCart() is called both from Route Handlers/Server Actions (where
    // writing a cookie is allowed) and directly from plain Server Component
    // pages (/cart, /checkout — where Next.js forbids it and throws). A
    // brand-new visitor with no cart cookie yet hitting one of those pages
    // directly used to crash the whole page with a 500 here — confirmed
    // live in production. The cart above was still created successfully in
    // the backend and is fine to render with; it just won't be remembered
    // across requests from this call site. The moment the visitor actually
    // adds an item, that goes through a real Route Handler/Server Action,
    // which sets the cookie correctly from that point on.
  }
  return cart;
}
