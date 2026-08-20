'use client';

import { useActionState, useState } from 'react';
import { removeAttributeFromSet, type ActionState } from '../actions';
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
import { X } from 'lucide-react';

const initialState: ActionState = { error: null, success: false };

export function RemoveAttributeDialog({
  attributeSetId,
  attributeCode,
  attributeLabel,
}: {
  attributeSetId: string;
  attributeCode: string;
  attributeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(removeAttributeFromSet, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label={`Remove ${attributeLabel}`}>
            <X className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {attributeLabel} From This Set?</DialogTitle>
          <DialogDescription>
            It stays in the reusable attribute library and can be re-assigned later. Any value a
            product already has stored for it is kept, not erased.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="attributeSetId" value={attributeSetId} />
          <input type="hidden" name="attributeCode" value={attributeCode} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Removing…' : 'Remove From Set'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
