'use client';

import { useActionState, useState } from 'react';
import { deleteWidget, type ActionState } from './actions';
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

export function DeleteWidgetDialog({ publicId, label }: { publicId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteWidget, initialState);
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
          <DialogTitle>Delete Widget — {label}</DialogTitle>
          <DialogDescription>It stops rendering on the storefront immediately.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={publicId} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Widget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
