'use client';

import { useActionState, useState } from 'react';
import { createCurrency, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewCurrencyDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCurrency, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Currency</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Currency</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cur-code">Code</Label>
            <Input id="cur-code" name="code" required maxLength={3} placeholder="e.g. INR" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur-symbol">Symbol</Label>
            <Input id="cur-symbol" name="symbol" required placeholder="e.g. ₹" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur-name">Name</Label>
            <Input id="cur-name" name="name" required placeholder="e.g. Indian Rupee" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur-minorUnits">Minor units</Label>
            <Input id="cur-minorUnits" name="minorUnits" type="number" step="1" min="0" defaultValue={2} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Currency'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
