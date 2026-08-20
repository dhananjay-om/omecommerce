'use client';

import { useActionState, useState } from 'react';
import { createShippingMethod, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewShippingMethodDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createShippingMethod, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Shipping Method</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Shipping Method</DialogTitle>
          <DialogDescription>
            Checkout only offers methods matching the cart&apos;s currency — a method priced in USD
            never shows up for an INR checkout, and vice versa.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sm-code">Code</Label>
            <Input id="sm-code" name="code" required placeholder="e.g. STANDARD" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sm-name">Name</Label>
            <Input id="sm-name" name="name" required placeholder="e.g. Standard Shipping" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sm-flatRate">Flat rate</Label>
            <Input id="sm-flatRate" name="flatRate" required placeholder="e.g. 49.00 or 0 for free" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sm-currency">Currency</Label>
            <Input id="sm-currency" name="currency" required maxLength={3} placeholder="e.g. INR" className="uppercase" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Shipping Method'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
