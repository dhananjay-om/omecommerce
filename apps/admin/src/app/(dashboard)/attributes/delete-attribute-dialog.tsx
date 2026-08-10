'use client';

import { useActionState, useState } from 'react';
import { deleteAttribute, type ActionState } from './actions';
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

export function DeleteAttributeDialog({ code, label }: { code: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAttribute, initialState);
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
            aria-label={`Delete ${label}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Attribute — {label}</DialogTitle>
          <DialogDescription>
            This removes it from the reusable attribute library. If it&apos;s still assigned to any
            attribute set, deletion is blocked — remove it from those sets first.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Attribute'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
