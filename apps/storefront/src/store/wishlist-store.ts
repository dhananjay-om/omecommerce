import { create } from 'zustand';

interface WishlistState {
  productIds: Set<string>;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

/**
 * Local-only for now (plan/14 Phase 1) — the backend already has a full
 * wishlist module (create/add/remove/list, customer-auth-gated), but wiring
 * it up is Phase 4 (PDP wishlist button)/Phase 6 (account wishlist page)'s
 * job. This gives the header a working heart-toggle affordance in the
 * meantime without faking server persistence.
 */
export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: new Set(),
  toggle: (productId) =>
    set((state) => {
      const next = new Set(state.productIds);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return { productIds: next };
    }),
  has: (productId) => get().productIds.has(productId),
}));
