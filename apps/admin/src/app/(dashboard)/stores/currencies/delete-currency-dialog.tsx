'use client';

import { useActionState, useState } from 'react';
import { deleteCurrency, type ActionState } from './actions';
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

export function DeleteCurrencyDialog({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteCurrency, initialState);
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
          <DialogTitle>Delete Currency — {name}</DialogTitle>
          <DialogDescription>
            Only works if nothing uses it yet — a website&apos;s base currency, a price list, or any
            existing order/cart/wallet/gift card in this currency will block it.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Currency'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
