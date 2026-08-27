'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import { friendlyTenderError, type FriendlyTenderError } from '@/lib/friendly-tender-error';
import type { Cart } from '@/types/cart';

/** No code to type (unlike GiftCardField) — a signed-in customer's own wallet
 *  is a single yes/no tender, so this is a checkbox, not a form. */
export function WalletToggle({
  cart,
  walletBalance,
}: {
  cart: Cart;
  /** null covers a guest AND a signed-in shopper with a stale/invalid session (see
   *  loadForSignedInShopper) — either way there's no usable wallet to pay with right
   *  now, so nothing renders at all rather than a checkbox that would just fail on
   *  click with a confusing "session expired" message a guest never had a session to
   *  expire in the first place. */
  walletBalance: string | null;
}) {
  const applyWallet = useCartStore((s) => s.applyWallet);
  const removeWallet = useCartStore((s) => s.removeWallet);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FriendlyTenderError | null>(null);

  const walletTender = cart.tenders.find((t) => t.tenderType === 'WALLET');

  if (walletBalance === null) return null;

  // Admin-configured rule blocking the tender entirely right now (store-wide
  // disabled, or this cart doesn't clear the configured minimum order value)
  // — plan/17. Never a checkbox in this state: there's nothing to toggle.
  if (cart.walletUnavailableReason) {
    return (
      <p className="text-xs text-slate">
        Pay with wallet balance — {cart.walletUnavailableReason}.
      </p>
    );
  }

  async function handleToggle(checked: boolean) {
    setPending(true);
    setError(null);
    try {
      if (checked) await applyWallet();
      else await removeWallet();
    } catch (err) {
      setError(friendlyTenderError(err, 'Could not update your wallet tender.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id="wallet-toggle"
          checked={!!walletTender}
          disabled={pending}
          onCheckedChange={(checked) => handleToggle(checked === true)}
        />
        <Label htmlFor="wallet-toggle" className="text-sm font-normal">
          Pay with wallet balance
          {walletTender && Number(walletTender.appliedAmount) > 0 ? (
            <span className="text-green-700">
              {' '}
              (-{formatPrice(walletTender.appliedAmount, cart.currency)})
            </span>
          ) : null}
        </Label>
      </div>
      {/* Shown unconditionally once we're past the walletBalance === null early
          return above, including a genuine ₹0.00 — a shopper deciding whether
          to check this box needs to know their balance either way, not just
          once it's already been applied. */}
      <p className="pl-6 text-xs text-slate">
        Available balance: {formatPrice(walletBalance, cart.currency)}
      </p>
      {error ? (
        <p className="text-sm text-destructive">
          {error.message}
          {error.sessionExpired ? (
            <>
              {' '}
              <Link href="/login" target="_blank" rel="noreferrer" className="underline">
                Log in again
              </Link>
              , then check the box once more.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
