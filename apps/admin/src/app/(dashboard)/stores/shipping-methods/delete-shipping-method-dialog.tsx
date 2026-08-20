'use client';

import { useActionState, useState } from 'react';
import { deleteShippingMethod, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function DeleteShippingMethodDialog({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteShippingMethod, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Shipping Method — {name}</DialogTitle>
          <DialogDescription>
            Soft-deleted only — it stops being offered at checkout, but any order that already used
            it keeps its own snapshotted method/amount untouched.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Shipping Method'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
