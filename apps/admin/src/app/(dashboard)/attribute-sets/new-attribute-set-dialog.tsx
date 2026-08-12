'use client';

import { useActionState, useState } from 'react';
import { createAttributeSet, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewAttributeSetDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAttributeSet, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Attribute Set</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Attribute Set</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="as-code">Code</Label>
            <Input id="as-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="as-name">Name</Label>
            <Input id="as-name" name="name" required />
          </div>
          <div className="flex items-center gap-2">
            <input id="as-default" name="isDefault" type="checkbox" className="size-4" />
            <Label htmlFor="as-default">Default set</Label>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Attribute Set'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
