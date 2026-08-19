'use client';

import { useActionState, useState } from 'react';
import { adjustCompanyCredit, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AdjustCreditDialog({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);
  const action = adjustCompanyCredit.bind(null, publicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Adjust</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Credit Balance</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acj-amount">Amount</Label>
            <Input id="acj-amount" name="amount" required placeholder="e.g. 100.00 or -50.00" />
            <p className="text-xs text-muted-foreground">
              Signed — a positive amount increases what&apos;s owed (rejected if it would exceed the
              credit limit), a negative amount decreases it (floored at 0).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acj-reason">Reason</Label>
            <Input
              id="acj-reason"
              name="reason"
              required
              placeholder="e.g. Correcting a duplicate charge"
            />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adjusting…' : 'Adjust Balance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
