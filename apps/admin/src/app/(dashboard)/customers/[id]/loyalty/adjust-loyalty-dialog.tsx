'use client';

import { useActionState, useState } from 'react';
import { adjustLoyaltyAccount, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AdjustLoyaltyDialog({ customerPublicId }: { customerPublicId: string }) {
  const [open, setOpen] = useState(false);
  const action = adjustLoyaltyAccount.bind(null, customerPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Adjust Points</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Loyalty Points</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-points">Points</Label>
            <Input id="adjust-points" name="points" required placeholder="e.g. 100 to grant, -50 to correct" />
            <p className="text-xs text-muted-foreground">
              Signed — a positive number grants points, a negative number debits them (rejected if it would
              take the balance below zero).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-loyalty-reason">Reason</Label>
            <Input id="adjust-loyalty-reason" name="reason" required placeholder="e.g. goodwill gesture" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adjusting…' : 'Adjust Points'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
