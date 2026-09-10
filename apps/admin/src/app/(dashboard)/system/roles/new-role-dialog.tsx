'use client';

import { useActionState, useState } from 'react';
import { createRole, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function NewRoleDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRole, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Role</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Role</DialogTitle>
          <DialogDescription>Starts with no permissions granted — add them from the role&apos;s own edit page next.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" name="name" required placeholder="e.g. Catalog Editor" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-code">Code</Label>
            <Input id="role-code" name="code" required placeholder="e.g. catalog-editor" pattern="[a-z0-9-]+" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only. Can&apos;t be changed after creation.</p>
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
