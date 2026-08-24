'use client';

import { useActionState, useState } from 'react';
import { cancelOrder, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function CancelDialog({
  orderPublicId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  orderPublicId: string;
  /** When provided, this dialog is externally controlled (e.g. opened from
   *  `OrderActionsMenu`'s "..." menu) and renders no trigger of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const action = cancelOrder.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? <DialogTrigger render={<Button variant="destructive">Cancel Order</Button>} /> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            This fully refunds and restocks the order and cannot be undone. Continue?
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea id="cancel-reason" name="reason" rows={2} placeholder="Why is this order being cancelled?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancel-refund-to">Refund to</Label>
            <select id="cancel-refund-to" name="refundTo" defaultValue="ORIGINAL_PAYMENT_METHOD" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none">
              <option value="ORIGINAL_PAYMENT_METHOD">Original payment method</option>
              <option value="WALLET">Store credit (wallet)</option>
            </select>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
