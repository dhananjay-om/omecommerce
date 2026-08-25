'use client';

import { useActionState, useState } from 'react';
import { deleteOrder, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** Mirrors DeleteOrder's own guard (delete-order.usecase.ts) — exported so
 *  both `OrdersTable`'s row menu and `OrderActionsMenu` can decide whether
 *  to show "Delete Order" at all, same convention as closeEligibility. */
export function deleteEligible(status: string): boolean {
  return status === 'CANCELLED' || status === 'CLOSED';
}

export function DeleteOrderDialog({
  orderPublicId,
  orderNumber,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onDeleted,
}: {
  orderPublicId: string;
  orderNumber: string;
  /** When provided, this dialog is externally controlled (e.g. opened from
   *  a row's "..." menu) and renders no trigger of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after a successful delete, in addition to closing the dialog —
   *  the order detail page uses this to navigate back to the list, since
   *  the order it's showing no longer exists. */
  onDeleted?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const action = deleteOrder.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setOpen(false);
      onDeleted?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger render={<Button variant="destructive">Delete Order</Button>} />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Order #{orderNumber}</DialogTitle>
          <DialogDescription>
            This permanently removes the order and everything on it (line items, payments,
            fulfillments, invoices, history) — there is no undo. Unlike Cancel, this doesn&apos;t
            issue a refund or restock (both already happened when the order was cancelled/closed).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
