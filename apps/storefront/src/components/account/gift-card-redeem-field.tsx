'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { redeemGiftCard } from '@/services/rewards.service';

/** Modeled 1:1 on cart/coupon-field.tsx — local state, inline error, toast on
 *  success, router.refresh() to pick up the new wallet balance server-side. */
export function GiftCardRedeemField() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    try {
      const result = await redeemGiftCard(code.trim());
      setCode('');
      toast.success(`Gift card redeemed — ${result.redeemedAmount} added to your store credit.`);
      router.refresh();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not redeem that gift card.') : 'Could not redeem that gift card.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input placeholder="Gift card code" value={code} onChange={(e) => setCode(e.target.value)} disabled={pending} />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Redeeming…' : 'Redeem'}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
