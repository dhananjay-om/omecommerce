import { create } from 'zustand';
import {
  getCart,
  addLine as addLineRequest,
  removeLine as removeLineRequest,
  applyCoupon as applyCouponRequest,
  removeCoupon as removeCouponRequest,
} from '@/services/cart.service';
import type { Cart } from '@/types/cart';

interface CartState {
  cart: Cart | null;
  itemCount: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addLine: (variantId: string, qty: number) => Promise<void>;
  removeLine: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
}

export function countItems(cart: Cart | null): number {
  return cart ? cart.lines.reduce((sum, l) => sum + l.qty, 0) : 0;
}

/** Holds the full CartView from Phase 0d's endpoints — no separate client-side normalization needed. */
export const useCartStore = create<CartState>((set) => ({
  cart: null,
  itemCount: 0,
  hydrated: false,
  hydrate: async () => {
    const cart = await getCart();
    set({ cart, itemCount: countItems(cart), hydrated: true });
  },
  addLine: async (variantId, qty) => {
    const cart = await addLineRequest(variantId, qty);
    set({ cart, itemCount: countItems(cart) });
  },
  removeLine: async (variantId) => {
    const cart = await removeLineRequest(variantId);
    set({ cart, itemCount: countItems(cart) });
  },
  applyCoupon: async (code) => {
    const cart = await applyCouponRequest(code);
    set({ cart, itemCount: countItems(cart) });
  },
  removeCoupon: async () => {
    const cart = await removeCouponRequest();
    set({ cart, itemCount: countItems(cart) });
  },
}));
