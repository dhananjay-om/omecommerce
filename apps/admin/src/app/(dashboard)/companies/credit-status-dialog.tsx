'use client';

import { useActionState, useState } from 'react';
import { setCompanyCreditStatus, type ActionState } from './actions';
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

const initialState: ActionState = { error: null, success: false };

/** One dialog, two modes selected by the credit account's current status — freezing blocks
 *  further charges at checkout (payments/adjustments still work), unfreezing restores charging. */
export function CreditStatusDialog({
  publicId,
  status,
}: {
  publicId: string;
  status: 'ACTIVE' | 'FROZEN';
}) {
  const [open, setOpen] = useState(false);
  const frozen = status === 'FROZEN';
  const action = setCompanyCreditStatus.bind(null, publicId, frozen ? 'ACTIVE' : 'FROZEN');
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
          <Button
            variant="outline"
            className={frozen ? undefined : 'text-destructive hover:text-destructive'}
          >
            {frozen ? 'Unfreeze' : 'Freeze'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{frozen ? 'Unfreeze Credit Account' : 'Freeze Credit Account'}</DialogTitle>
          <DialogDescription>
            {frozen
              ? 'Restores this credit account to normal — it can be charged at checkout again.'
              : 'Blocks further charges at checkout until unfrozen. Payments and adjustments still work.'}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant={frozen ? 'default' : 'destructive'} disabled={pending}>
              {pending ? 'Saving…' : frozen ? 'Unfreeze Account' : 'Freeze Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
