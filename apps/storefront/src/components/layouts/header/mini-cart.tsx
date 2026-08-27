'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import { TaxInclusiveNote } from '@/components/tax-inclusive-note';
import { FreeShippingBar } from '@/components/cart/free-shipping-bar';

export function MiniCart() {
  const { cart, itemCount, hydrated, hydrate, removeLine } = useCartStore();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open cart" className="relative">
            <ShoppingBagIcon className="size-6" />
            {itemCount > 0 ? (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full bg-champagne px-1 text-[10px] text-white">
                {itemCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <SheetContent side="right" className="gap-0">
        <SheetHeader className="border-b border-ghost p-5">
          <SheetTitle className="font-display text-lg font-semibold text-jet">Your Bag</SheetTitle>
          <p className="text-xs text-slate">{!cart || cart.lines.length === 0 ? 'Nothing in here yet' : `${itemCount} item${itemCount === 1 ? '' : 's'}`}</p>
        </SheetHeader>

        {cart && cart.subtotal ? <FreeShippingBar subtotal={cart.subtotal} currency={cart.currency} className="mx-4 mt-4" /> : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-sand">
                <ShoppingBagIcon className="size-6 text-silver" />
              </div>
              <p className="text-sm text-slate">Your bag is empty.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
                      <img src={line.imageUrl} alt={line.name} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 text-sm">
                    <span className="line-clamp-1 font-medium text-jet">{line.name}</span>
                    <span className="text-slate">Qty {line.qty}</span>
                    <span className="font-semibold text-jet">
                      {line.lineTotal ? formatPrice(line.lineTotal, cart.currency) : 'Price unavailable'}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove item" onClick={() => removeLine(line.variantId)}>
                    <XMarkIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart && cart.subtotal ? (
          <div className="flex items-center justify-between border-t border-ghost px-5 pt-4 text-sm font-semibold text-jet">
            <span>Subtotal</span>
            <span>
              {formatPrice(cart.subtotal, cart.currency)}
              {cart.pricesIncludeTax ? <TaxInclusiveNote /> : null}
            </span>
          </div>
        ) : null}
        <SheetFooter className="px-5 pb-5">
          <Button variant="cta" render={<Link href="/cart" />} nativeButton={false}>
            View Cart
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
