'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCartStore, countItems } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import { TaxInclusiveNote } from '@/components/tax-inclusive-note';
import { CartLineRow } from './cart-line-row';
import { CouponField } from './coupon-field';
import { GiftCardField } from './gift-card-field';
import { WalletToggle } from './wallet-toggle';
import type { Cart } from '@/types/cart';

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
            <CartLineRow key={line.id} line={line} currency={displayCart.currency} pricesIncludeTax={displayCart.pricesIncludeTax} />
          ))}
        </div>

        <div className="flex w-full flex-col gap-4 rounded-lg border p-5 lg:w-80">
          <h2 className="font-semibold">Order Summary</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{displayCart.subtotal ? formatPrice(displayCart.subtotal, displayCart.currency) : '—'}</span>
            </div>
            {displayCart.discountTotal ? (
              <div className="flex justify-between text-success">
                <span>Discount{displayCart.couponCode ? ` (${displayCart.couponCode})` : ''}</span>
                <span>-{formatPrice(displayCart.discountTotal, displayCart.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="text-muted-foreground">Calculated at checkout</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax{!displayCart.pricesIncludeTax && displayCart.taxTotal ? ' (estimated)' : ''}</span>
              <span className={displayCart.pricesIncludeTax ? 'text-muted-foreground' : undefined}>
                {displayCart.taxTotal
                  ? displayCart.pricesIncludeTax
                    ? `${formatPrice(displayCart.taxTotal, displayCart.currency)} included above`
                    : formatPrice(displayCart.taxTotal, displayCart.currency)
                  : displayCart.pricesIncludeTax
                    ? 'Included in prices above'
                    : 'Calculated at checkout'}
              </span>
            </div>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-bold">
            <span>Estimated Total</span>
            <span>
              {displayCart.estimatedTotal ? formatPrice(displayCart.estimatedTotal, displayCart.currency) : '—'}
              {displayCart.estimatedTotal && displayCart.pricesIncludeTax ? <TaxInclusiveNote /> : null}
            </span>
          </div>

          {displayCart.customerGroupName ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Your <span className="font-medium text-foreground">{displayCart.customerGroupName}</span> pricing is applied to this order.
            </p>
          ) : null}

          <CouponField cart={displayCart} />
          <GiftCardField cart={displayCart} />
          <WalletToggle cart={displayCart} />
          {displayCart.tenders.length > 0 && displayCart.amountDue !== null ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Amount due</span>
              <span>{formatPrice(displayCart.amountDue, displayCart.currency)}</span>
            </div>
          ) : null}

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
