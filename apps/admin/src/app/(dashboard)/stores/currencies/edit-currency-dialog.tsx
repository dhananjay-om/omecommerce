'use client';

import { useActionState, useState } from 'react';
import { updateCurrency, type ActionState } from './actions';
import type { Currency } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function EditCurrencyDialog({ currency }: { currency: Currency }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateCurrency, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Currency — {currency.code}</DialogTitle>
          <DialogDescription>The code can&apos;t be changed after creation — it&apos;s referenced by price lists.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={currency.code} />
          <div className="space-y-2">
            <Label htmlFor="edit-cur-symbol">Symbol</Label>
            <Input id="edit-cur-symbol" name="symbol" required defaultValue={currency.symbol} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cur-name">Name</Label>
            <Input id="edit-cur-name" name="name" required defaultValue={currency.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cur-minorUnits">Minor units</Label>
            <Input id="edit-cur-minorUnits" name="minorUnits" type="number" step="1" min="0" defaultValue={currency.minorUnits} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
