'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import type { Cart } from '@/types/cart';

/** No code to type (unlike GiftCardField) — a signed-in customer's own wallet
 *  is a single yes/no tender, so this is a checkbox, not a form. */
export function WalletToggle({ cart }: { cart: Cart }) {
  const applyWallet = useCartStore((s) => s.applyWallet);
  const removeWallet = useCartStore((s) => s.removeWallet);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletTender = cart.tenders.find((t) => t.tenderType === 'WALLET');

  async function handleToggle(checked: boolean) {
    setPending(true);
    setError(null);
    try {
      if (checked) await applyWallet();
      else await removeWallet();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not update your wallet tender.') : 'Could not update your wallet tender.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox id="wallet-toggle" checked={!!walletTender} disabled={pending} onCheckedChange={(checked) => handleToggle(checked === true)} />
        <Label htmlFor="wallet-toggle" className="text-sm font-normal">
          Pay with wallet balance
          {walletTender && Number(walletTender.appliedAmount) > 0 ? (
            <span className="text-success"> (-{formatPrice(walletTender.appliedAmount, cart.currency)})</span>
          ) : null}
        </Label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
