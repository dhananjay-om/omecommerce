'use client';

import { useActionState, useState } from 'react';
import { adjustGiftCard, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AdjustGiftCardDialog({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);
  const action = adjustGiftCard.bind(null, publicId);
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
          <DialogTitle>Adjust Gift Card Balance</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gc-adjust-amount">Amount</Label>
            <Input id="gc-adjust-amount" name="amount" required placeholder="e.g. 5.00 to credit back, -5.00 to correct" />
            <p className="text-xs text-muted-foreground">Signed — a negative amount is rejected if it would overdraw the balance.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-adjust-reason">Reason</Label>
            <Input id="gc-adjust-reason" name="reason" required placeholder="e.g. goodwill top-up" />
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
