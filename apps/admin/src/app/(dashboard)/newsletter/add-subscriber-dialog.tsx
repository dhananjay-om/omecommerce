'use client';

import { useActionState, useState } from 'react';
import { addSubscriber, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function AddSubscriberDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addSubscriber, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Subscriber</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Subscriber</DialogTitle>
          <DialogDescription>
            Only add people who have agreed to receive your newsletter. An address that previously
            unsubscribed is re-subscribed.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nl-email">Email</Label>
            <Input id="nl-email" name="email" type="email" required placeholder="name@example.com" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add Subscriber'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
