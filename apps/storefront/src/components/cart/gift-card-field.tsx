'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import type { Cart } from '@/types/cart';

/** Modeled 1:1 on coupon-field.tsx, except a cart can carry several distinct
 *  gift cards at once (stackable) — so this renders one applied-card row per
 *  tender, each with its own Remove, rather than a single applied/not-applied state. */
export function GiftCardField({ cart }: { cart: Cart }) {
  const applyGiftCard = useCartStore((s) => s.applyGiftCard);
  const removeGiftCard = useCartStore((s) => s.removeGiftCard);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appliedGiftCards = cart.tenders.filter((t) => t.tenderType === 'GIFT_CARD');

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    try {
      await applyGiftCard(code.trim());
      setCode('');
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not apply that gift card.') : 'Could not apply that gift card.');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(giftCardPublicId: string | null) {
    if (!giftCardPublicId) return;
    setPending(true);
    setError(null);
    try {
      await removeGiftCard(giftCardPublicId);
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not remove that gift card.') : 'Could not remove that gift card.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {appliedGiftCards.map((t, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-champagne/30 bg-white px-3 py-2 text-sm">
          <span className="text-charcoal">
            Gift card <span className="font-mono">•••• {t.giftCardLast4}</span>
            {Number(t.appliedAmount) > 0 ? <span className="text-green-700"> (-{formatPrice(t.appliedAmount, cart.currency)})</span> : null}
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => handleRemove(t.giftCardPublicId)}>
            Remove
          </Button>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={handleApply}>
        <Input placeholder="Gift card code" value={code} onChange={(e) => setCode(e.target.value)} disabled={pending} />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Applying…' : 'Apply'}
        </Button>
      </form>
      {cart.tenderError ? <p className="text-sm text-destructive">{cart.tenderError}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
