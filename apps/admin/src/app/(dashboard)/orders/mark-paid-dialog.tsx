'use client';

import { useActionState, useState } from 'react';
import { markOrderPaid, type ActionState } from './actions';
import type { OrderDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** Only real for a COD (or any other "collect later") order — every other
 *  financialStatus already means money moved through a different path
 *  already, or the order was explicitly rejected. See
 *  MarkOrderPaidManually's own header comment for the full reasoning. */
export function MarkPaidDialog({ order }: { order: OrderDetail }) {
  const [open, setOpen] = useState(false);
  const action = markOrderPaid.bind(null, order.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  if (order.financialStatus !== 'PENDING') return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Mark as Paid</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Paid — Cash Collected</DialogTitle>
          <DialogDescription>
            Records the amount actually collected (e.g. from the delivery agent), flips this order
            to Paid, and — only now — triggers loyalty points and referral rewards for it.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mp-amount">Amount collected ({order.currency})</Label>
            <Input id="mp-amount" name="amount" required defaultValue={order.grandTotal} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-note">Note (optional)</Label>
            <Textarea id="mp-note" name="note" placeholder="e.g. collected by courier on delivery" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
