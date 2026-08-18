'use client';

import { useActionState, useState } from 'react';
import { adjustWallet, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import type { WalletBucket } from '@/lib/types';

const BUCKET_LABELS: Record<WalletBucket, string> = {
  STORE_CREDIT: 'Store Credit',
  PREPAID_TOPUP: 'Prepaid Top-up',
  CASHBACK: 'Cashback',
  LOYALTY_CONVERSION: 'Loyalty Conversion',
};

const initialState: ActionState = { error: null, success: false };

export function AdjustWalletDialog({ customerPublicId }: { customerPublicId: string }) {
  const [open, setOpen] = useState(false);
  const action = adjustWallet.bind(null, customerPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Adjust</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Wallet Balance</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-amount">Amount</Label>
            <Input id="adjust-amount" name="amount" required placeholder="e.g. 20.00 to grant, -10.00 to correct" />
            <p className="text-xs text-muted-foreground">
              Signed — a positive amount grants, a negative amount debits (rejected if it would overdraw the balance).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-bucket">Bucket</Label>
            <Select name="bucket" defaultValue="STORE_CREDIT">
              <SelectTrigger id="adjust-bucket" className="w-full">
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
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input id="adjust-reason" name="reason" required placeholder="e.g. correcting an over-grant" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adjusting…' : 'Adjust Balance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
