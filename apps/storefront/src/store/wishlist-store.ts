import { create } from 'zustand';
import { api } from '@/lib/axios';
import { useAuthStore } from './auth-store';
import type { Wishlist } from '@/types/customer';

export type WishlistToggleResult = 'added' | 'removed' | 'login-required' | 'error';

interface WishlistState {
  productIds: Set<string>;
  hydrated: boolean;
  /** Loads the logged-in customer's real wishlist product ids from the
   *  backend (via GET /api/wishlist -> ensureWishlist) so every heart icon
   *  across the app reflects true server state on first render, not just
   *  whatever got toggled locally this session. Call sites gate this behind
   *  `useAuthStore`'s own `isLoggedIn`/`hydrated` (see user-menu.tsx) —
   *  calling it while logged out is a no-op (nothing to load), not an error. */
  hydrate: () => Promise<void>;
  has: (productId: string) => boolean;
  /**
   * Real backend-backed toggle (POST/DELETE /api/wishlist, which proxy to
   * the real customer-auth-gated wishlist module) — not local-only. Updates
   * `productIds` optimistically, then reverts on a failed request. Returns
   * 'login-required' without calling the API at all when the customer isn't
   * logged in (the wishlist module requires a real customer id) — callers
   * show a "log in" prompt for that case instead of silently no-op'ing.
   */
  toggle: (productId: string) => Promise<WishlistToggleResult>;
  /** Clears local state on logout — real per-customer data, so it shouldn't
   *  keep showing on a shared device after the next person logs in as a
   *  guest or a different customer (same reasoning as clearing the cart on
   *  a store switch, see store-context.ts). */
  reset: () => void;
  /** Syncs the local mirror after a removal made through a DIFFERENT real
   *  API call this store didn't make itself — the Account > Wishlist page
   *  (wishlist-list.tsx) already knows the item is wishlisted (it's on the
   *  page) and does its own DELETE, so it doesn't need `toggle`'s "guess
   *  the direction from local state" logic, which could get it backwards
   *  before this store has hydrated. No network request — local-only. */
  syncRemoved: (productId: string) => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: new Set(),
  hydrated: false,
  hydrate: async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      set({ hydrated: true });
      return;
    }
    try {
      const { data: wishlist } = await api.get<Wishlist>('/wishlist');
      set({ productIds: new Set(wishlist.items.map((i) => i.productId)), hydrated: true });
    } catch {
      // A failed load just leaves hearts unfilled until the next hydrate —
      // same "don't crash the page over a display detail" posture as
      // formatPrice's own fallback.
      set({ hydrated: true });
    }
  },
  has: (productId) => get().productIds.has(productId),
  toggle: async (productId) => {
    if (!useAuthStore.getState().isLoggedIn) return 'login-required';
    const wasWishlisted = get().has(productId);
    set((state) => {
      const next = new Set(state.productIds);
      if (wasWishlisted) next.delete(productId);
      else next.add(productId);
      return { productIds: next };
    });
    try {
      if (wasWishlisted) await api.delete(`/wishlist/${productId}`);
      else await api.post('/wishlist', { productId });
      return wasWishlisted ? 'removed' : 'added';
    } catch {
      set((state) => {
        const next = new Set(state.productIds);
        if (wasWishlisted) next.add(productId);
        else next.delete(productId);
        return { productIds: next };
      });
      return 'error';
    }
  },
  reset: () => set({ productIds: new Set(), hydrated: false }),
  syncRemoved: (productId) =>
    set((state) => {
      const next = new Set(state.productIds);
      next.delete(productId);
      return { productIds: next };
    }),
}));
