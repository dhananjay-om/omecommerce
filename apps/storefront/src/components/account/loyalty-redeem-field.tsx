'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { redeemLoyaltyPoints } from '@/services/rewards.service';

/** Modeled 1:1 on cart/coupon-field.tsx. `redeemMinPoints` is checked client-side
 *  before submit — a plain-English error beats a round trip to the API for the
 *  most common mistake (redeeming below the program's floor). */
export function LoyaltyRedeemField({ pointsBalance, redeemMinPoints }: { pointsBalance: string; redeemMinPoints: number }) {
  const router = useRouter();
  const [points, setPoints] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = points.trim();
    if (!value) return;
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      setError('Enter a whole number of points.');
      return;
    }
    if (Number(value) < redeemMinPoints) {
      setError(`This program requires at least ${redeemMinPoints} points per redemption.`);
      return;
    }
    if (Number(value) > Number(pointsBalance)) {
      setError(`You only have ${pointsBalance} points available.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await redeemLoyaltyPoints(value);
      setPoints('');
      toast.success(`Redeemed ${result.redeemedPoints} points — ${result.storeCreditAmount} added to your store credit.`);
      router.refresh();
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.error ?? 'Could not redeem those points.') : 'Could not redeem those points.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          placeholder={`Points to redeem (min ${redeemMinPoints})`}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          disabled={pending}
          inputMode="numeric"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? 'Redeeming…' : 'Redeem'}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
