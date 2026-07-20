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
