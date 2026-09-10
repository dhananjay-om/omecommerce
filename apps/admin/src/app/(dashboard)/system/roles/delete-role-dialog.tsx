'use client';

import { useActionState, useState } from 'react';
import { deleteRole, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function DeleteRoleDialog({ code, name, blockedReason }: { code: string; name: string; blockedReason: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteRole, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  if (blockedReason) {
    return (
      <Button variant="outline" size="sm" disabled title={blockedReason} className="text-destructive">
        Delete
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role — {name}</DialogTitle>
          <DialogDescription>Permanent — a role is security configuration, not a historical record, so this isn&apos;t reversible.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
