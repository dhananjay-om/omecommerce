'use client';

import { useActionState, useState } from 'react';
import { recordCompanyCreditPayment, type ActionState } from './actions';
import type { OpenInvoiceView } from '@/lib/types';
import { formatPrice } from '@/lib/format-price';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function RecordCreditPaymentDialog({
  publicId,
  invoices,
}: {
  publicId: string;
  invoices: OpenInvoiceView[];
}) {
  const [open, setOpen] = useState(false);
  const action = recordCompanyCreditPayment.bind(null, publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={invoices.length === 0}>
            Record Payment
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Applies a payment and settles every invoice you select below.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rcp-amount">Amount</Label>
            <Input id="rcp-amount" name="amount" required placeholder="e.g. 500.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rcp-reason">Reason (optional)</Label>
            <Input id="rcp-reason" name="reason" placeholder="e.g. Wire transfer received" />
          </div>
          <div className="space-y-2">
            <Label>Open Invoices to Settle</Label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {invoices.map((inv) => (
                <div key={inv.orderPublicId} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id={`rcp-inv-${inv.orderPublicId}`}
                    name="orderPublicIds"
                    value={inv.orderPublicId}
                    className="size-4"
                  />
                  <label htmlFor={`rcp-inv-${inv.orderPublicId}`} className="text-sm">
                    Order #{inv.orderNumber} — {formatPrice(inv.amount, inv.currency)} — due{' '}
                    {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">At least one invoice must be selected.</p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Recording…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
