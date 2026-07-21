'use client';

import { useActionState, useState } from 'react';
import { closeOrder, type ActionState } from './actions';
import type { OrderDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** plan/15 Phase 9 — mirrors CloseOrder's own guard (see close-order.usecase.ts's header comment for why "fully shipped" stands in for "fully delivered"). */
function closeEligibility(order: OrderDetail): { eligible: boolean; reason: string | null } {
  if (order.status === 'CLOSED') return { eligible: false, reason: null };
  if (order.status === 'CANCELLED') return { eligible: false, reason: null };
  if (order.fulfillmentStatus !== 'FULFILLED') {
    return { eligible: false, reason: 'This order can be closed once every line has been fully shipped.' };
  }
  if (order.financialStatus !== 'PAID' && order.financialStatus !== 'REFUNDED') {
    return { eligible: false, reason: `This order has a pending financial state (${order.financialStatus}) and can't be closed yet.` };
  }
  return { eligible: true, reason: null };
}

export function CloseOrderDialog({ order }: { order: OrderDetail }) {
  const [open, setOpen] = useState(false);
  const action = closeOrder.bind(null, order.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const { eligible, reason } = closeEligibility(order);
  if (order.status === 'CLOSED' || order.status === 'CANCELLED') return null;
  if (!eligible) {
    return <p className="self-center text-sm text-muted-foreground">{reason}</p>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Close Order</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Order</DialogTitle>
          <DialogDescription>Marks this order as closed — a terminal state distinct from Completed. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Closing…' : 'Confirm Close'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
