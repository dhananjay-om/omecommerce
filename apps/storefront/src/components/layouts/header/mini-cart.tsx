'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { useCartStore } from '@/store/cart-store';

/**
 * Deliberately minimal drawer for Phase 1 (badge + line list + link to the
 * real cart page) — the full cart experience (qty edit, totals, coupon
 * field) is Phase 5's job.
 */
export function MiniCart() {
  const { cart, itemCount, hydrated, hydrate } = useCartStore();

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
            <ul className="flex flex-col gap-3">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between text-sm">
                  <span>Variant {line.variantId}</span>
                  <span className="text-muted-foreground">Qty {line.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SheetFooter>
          <Button render={<Link href="/cart" />} nativeButton={false}>
            View Cart
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
