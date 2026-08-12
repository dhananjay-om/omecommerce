'use client';

import { useActionState, useState } from 'react';
import { createAttributeSetGroup, type ActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewGroupDialog({ attributeSetId }: { attributeSetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAttributeSetGroup, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Group</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="attributeSetId" value={attributeSetId} />
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-sort">Sort Order</Label>
            <Input id="group-sort" name="sortOrder" type="number" step="1" defaultValue={0} />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
