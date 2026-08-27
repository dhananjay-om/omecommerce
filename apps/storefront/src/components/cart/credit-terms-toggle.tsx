'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCartStore } from '@/store/cart-store';
import { formatPrice } from '@/lib/format-price';
import { friendlyTenderError, type FriendlyTenderError } from '@/lib/friendly-tender-error';
import type { Cart } from '@/types/cart';
import type { CompanyCreditAccount } from '@/types/company';

const TERMS_LABEL: Record<CompanyCreditAccount['termsType'], string> = {
  NET_15: 'Net 15',
  NET_30: 'Net 30',
  NET_45: 'Net 45',
  NET_60: 'Net 60',
};

/**
 * "Pay on account" — B2B Net-X credit terms (plan/15 Phase 7). Only ever
 * rendered by the caller when `account` is non-null and ACTIVE with
 * available credit (checkout/page.tsx resolves eligibility server-side via
 * getMyCompanyCredit() — a guest or a shopper with no usable credit account
 * never sees this at all, same "eligible" framing the plan uses). No code
 * to type, same shape as WalletToggle — just a checkbox.
 */
export function CreditTermsToggle({
  cart,
  account,
}: {
  cart: Cart;
  account: CompanyCreditAccount;
}) {
  const applyCreditTerms = useCartStore((s) => s.applyCreditTerms);
  const removeCreditTerms = useCartStore((s) => s.removeCreditTerms);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FriendlyTenderError | null>(null);

  const tender = cart.tenders.find((t) => t.tenderType === 'CREDIT_TERMS');

  async function handleToggle(checked: boolean) {
    setPending(true);
    setError(null);
    try {
      if (checked) await applyCreditTerms();
      else await removeCreditTerms();
    } catch (err) {
      setError(friendlyTenderError(err, 'Could not update your account terms.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id="credit-terms-toggle"
          checked={!!tender}
          disabled={pending}
          onCheckedChange={(checked) => handleToggle(checked === true)}
        />
        <Label htmlFor="credit-terms-toggle" className="text-sm font-normal">
          Pay on account ({TERMS_LABEL[account.termsType]})
          {tender && Number(tender.appliedAmount) > 0 ? (
            <span className="text-green-700">
              {' '}
              (-{formatPrice(tender.appliedAmount, cart.currency)})
            </span>
          ) : null}
        </Label>
      </div>
      <p className="pl-6 text-xs text-slate">
        Available credit: {formatPrice(account.available, account.currency)}
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
