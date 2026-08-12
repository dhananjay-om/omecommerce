import 'server-only';
import { apiGet, apiPost } from './api-client';
import type { Wishlist } from '@/types/customer';

/**
 * The backend supports multiple named wishlists per customer (plan/05 §2.6),
 * but the storefront only needs one flat list (matching the local
 * wishlistStore's single-Set model used while logged out) — this finds the
 * customer's first wishlist, creating one on first use.
 */
export async function ensureWishlist(): Promise<Wishlist> {
  const wishlists = await apiGet<Wishlist[]>('/store/v1/me/wishlists', { auth: true });
  if (wishlists[0]) return wishlists[0];
  return apiPost<Wishlist>('/store/v1/me/wishlists', {}, { auth: true });
}
