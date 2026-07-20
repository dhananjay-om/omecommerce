'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { useCartStore } from '@/store/cart-store';

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
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {itemCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {!cart || cart.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
                      <img src={line.imageUrl} alt={line.name} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 text-sm">
                    <span className="line-clamp-1 font-medium">{line.name}</span>
                    <span className="text-muted-foreground">Qty {line.qty}</span>
                    <span className="font-semibold">
                      {line.lineTotal ? `${cart.currency} ${Number(line.lineTotal).toFixed(2)}` : 'Price unavailable'}
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
          <div className="flex items-center justify-between border-t px-4 pt-4 text-sm font-semibold">
            <span>Subtotal</span>
            <span>
              {cart.currency} {Number(cart.subtotal).toFixed(2)}
            </span>
          </div>
        ) : null}
        <SheetFooter>
          <Button render={<Link href="/cart" />} nativeButton={false}>
            View Cart
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
