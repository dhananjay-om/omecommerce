'use client';

import { useActionState, useState } from 'react';
import { deleteCustomer, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

export function DeleteCustomerDialog({
  publicId,
  email,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  publicId: string;
  email: string;
  /** When provided, this dialog is externally controlled (e.g. opened from
   *  the customers table's row "..." menu) and renders no trigger of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [state, formAction, pending] = useActionState(deleteCustomer, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${email}`}
            >
              <Trash2 className="size-4" />
            </Button>
          }
        />
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Customer — {email}</DialogTitle>
          <DialogDescription>
            This deactivates the account and signs it out of every session — the customer can no longer
            log in. Their order history, wallet, loyalty, and referral records are all kept, not erased;
            past orders already have their own snapshot of the name, email, and prices at the time of
            purchase, so nothing there changes.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={publicId} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
