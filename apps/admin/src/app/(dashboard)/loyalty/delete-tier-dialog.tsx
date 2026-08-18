'use client';

import { useActionState, useState } from 'react';
import { deleteLoyaltyTier, type ActionState } from './actions';
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
import { Trash2 } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

/** Tier delete is a hard delete (no soft-delete column) — any customer currently sitting
 *  in this tier just falls to null and gets re-tiered on their next points earn. */
export function DeleteTierDialog({ programPublicId, tierId, name }: { programPublicId: string; tierId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const action = deleteLoyaltyTier.bind(null, programPublicId, tierId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Tier — {name}</DialogTitle>
          <DialogDescription>
            Any customer currently in this tier falls back to no tier and is re-assigned automatically the
            next time they earn points.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Tier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
