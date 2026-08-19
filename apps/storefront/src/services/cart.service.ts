import { api } from '@/lib/axios';
import type { Cart } from '@/types/cart';

/**
 * Client Component mutations only — via same-origin /api/cart Route
 * Handlers (see lib/axios.ts's header comment for why: the session cookie
 * is httpOnly, so client code can never call Express directly with it).
 */
export async function getCart(): Promise<Cart> {
  const res = await api.get<Cart>('/cart');
  return res.data;
}

export async function addLine(variantId: string, qty: number): Promise<Cart> {
  const res = await api.post<Cart>('/cart', { variantId, qty });
  return res.data;
}

export async function removeLine(variantId: string): Promise<Cart> {
  const res = await api.delete<Cart>(`/cart/lines/${variantId}`);
  return res.data;
}

export async function applyCoupon(code: string): Promise<Cart> {
  const res = await api.post<Cart>('/cart/coupon', { code });
  return res.data;
}

export async function removeCoupon(): Promise<Cart> {
  const res = await api.delete<Cart>('/cart/coupon');
  return res.data;
}

export async function applyGiftCard(code: string): Promise<Cart> {
  const res = await api.post<Cart>('/cart/gift-card', { code });
  return res.data;
}

export async function removeGiftCard(giftCardPublicId: string): Promise<Cart> {
  const res = await api.delete<Cart>('/cart/gift-card', { data: { giftCardPublicId } });
  return res.data;
}

/** requireCustomer-gated server-side — same-origin Route Handler resolves the caller's own session, no body needed. */
export async function applyWallet(): Promise<Cart> {
  const res = await api.post<Cart>('/cart/wallet');
  return res.data;
}

export async function removeWallet(): Promise<Cart> {
  const res = await api.delete<Cart>('/cart/wallet');
  return res.data;
}

/** requireCustomer-gated server-side — same-origin Route Handler resolves the caller's own session, no body needed. B2B "pay on account" (plan/15 Phase 7). */
export async function applyCreditTerms(): Promise<Cart> {
  const res = await api.post<Cart>('/cart/credit-terms');
  return res.data;
}

export async function removeCreditTerms(): Promise<Cart> {
  const res = await api.delete<Cart>('/cart/credit-terms');
  return res.data;
}
