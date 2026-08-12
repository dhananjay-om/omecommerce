'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore, countItems } from '@/store/cart-store';
import { CartLineRow } from './cart-line-row';
import type { Cart } from '@/types/cart';

/** Coupon field is present but non-functional — no promotion engine exists (plan/14 Phase 5 decision). */
function CouponField() {
  const [code, setCode] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) toast.info('Coupons are not available yet.');
      }}
    >
      <Input placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

export function CartPageClient({ initialCart }: { initialCart: Cart }) {
  const cart = useCartStore((s) => s.cart);
  const hydrated = useCartStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) {
      useCartStore.setState({ cart: initialCart, itemCount: countItems(initialCart), hydrated: true });
    }
    // Seed once from the server-rendered cart; afterwards the store is the single source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayCart = cart ?? initialCart;

  if (displayCart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">Looks like you haven&apos;t added anything yet.</p>
        <Button variant="cta" render={<Link href="/products" />} nativeButton={false}>
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Shopping Cart</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 rounded-lg border p-4">
          {displayCart.lines.map((line) => (
            <CartLineRow key={line.id} line={line} currency={displayCart.currency} />
          ))}
        </div>

        <div className="flex w-full flex-col gap-4 rounded-lg border p-5 lg:w-80">
          <h2 className="font-semibold">Order Summary</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{displayCart.subtotal ? `${displayCart.currency} ${Number(displayCart.subtotal).toFixed(2)}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-muted-foreground">Calculated at checkout</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-muted-foreground">Calculated at checkout</span>
            </div>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-bold">
            <span>Estimated Total</span>
            <span>{displayCart.subtotal ? `${displayCart.currency} ${Number(displayCart.subtotal).toFixed(2)}` : '—'}</span>
          </div>

          <CouponField />

          <Button variant="cta" size="lg" render={<Link href="/checkout" />} nativeButton={false}>
            Proceed to Checkout
          </Button>
          <Button variant="ghost" render={<Link href="/products" />} nativeButton={false}>
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
