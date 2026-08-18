'use client';

import { useActionState, useState } from 'react';
import { creditWallet, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { WalletBucket, WalletSource } from '@/lib/types';

const BUCKET_LABELS: Record<WalletBucket, string> = {
  STORE_CREDIT: 'Store Credit',
  PREPAID_TOPUP: 'Prepaid Top-up',
  CASHBACK: 'Cashback',
  LOYALTY_CONVERSION: 'Loyalty Conversion',
};

const CREDIT_SOURCES: WalletSource[] = ['GOODWILL', 'PROMO', 'ADMIN_ADJUST', 'TOPUP', 'CASHBACK'];
const SOURCE_LABELS: Record<WalletSource, string> = {
  REFUND: 'Refund',
  RETURN: 'Return',
  GOODWILL: 'Goodwill',
  TOPUP: 'Top-up',
  CASHBACK: 'Cashback',
  LOYALTY: 'Loyalty',
  GIFTCARD_LOAD: 'Gift Card Load',
  PROMO: 'Promo',
  ADMIN_ADJUST: 'Admin Adjustment',
  REFERRAL: 'Referral',
};

const initialState: ActionState = { error: null, success: false };

export function CreditWalletDialog({ customerPublicId }: { customerPublicId: string }) {
  const [open, setOpen] = useState(false);
  const action = creditWallet.bind(null, customerPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Credit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credit Wallet</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credit-amount">Amount</Label>
            <Input id="credit-amount" name="amount" required placeholder="e.g. 25.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-bucket">Bucket</Label>
            <Select name="bucket" defaultValue="STORE_CREDIT">
              <SelectTrigger id="credit-bucket" className="w-full">
                <SelectValue>{(value: WalletBucket) => BUCKET_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BUCKET_LABELS) as WalletBucket[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BUCKET_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-source">Source</Label>
            <Select name="source" defaultValue="GOODWILL">
              <SelectTrigger id="credit-source" className="w-full">
                <SelectValue>{(value: WalletSource) => SOURCE_LABELS[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CREDIT_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-reason">Reason (optional)</Label>
            <Input id="credit-reason" name="reason" placeholder="e.g. Goodwill gesture for delayed shipment" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Crediting…' : 'Credit Wallet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
