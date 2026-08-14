'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import type { Cart } from '@/types/cart';

/** Shared by the cart page and checkout page's Order Summary panels. */
export function CouponField({ cart }: { cart: Cart }) {
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    try {
      await applyCoupon(code.trim());
      setCode('');
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not apply that coupon.') : 'Could not apply that coupon.');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    try {
      await removeCoupon();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not remove the coupon.') : 'Could not remove the coupon.');
    } finally {
      setPending(false);
    }
  }

  if (cart.couponCode) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>
            Coupon applied: <span className="font-semibold">{cart.couponCode}</span>
            {cart.discountTotal ? <span className="text-success"> (-{formatPrice(cart.discountTotal, cart.currency)})</span> : null}
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleRemove}>
            Remove
          </Button>
        </div>
        {cart.couponError ? <p className="text-sm text-destructive">{cart.couponError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form className="flex gap-2" onSubmit={handleApply}>
        <Input placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} disabled={pending} />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Applying…' : 'Apply'}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
