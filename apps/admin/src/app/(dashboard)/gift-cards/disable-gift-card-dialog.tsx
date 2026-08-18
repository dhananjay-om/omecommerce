'use client';

import { useActionState, useState } from 'react';
import { disableGiftCard, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function DisableGiftCardDialog({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);
  const action = disableGiftCard.bind(null, publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="text-destructive hover:text-destructive">Disable</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Gift Card</DialogTitle>
          <DialogDescription>
            Blocks any further redemption of this card, permanently. Its remaining balance stays visible in
            the ledger but can no longer be spent — this cannot be undone from here.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Disabling…' : 'Disable Gift Card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
