'use client';

import { useActionState, useState } from 'react';
import { updateAdminUserRoles, type ActionState } from './actions';
import type { AdminUser, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function EditRolesDialog({ user, roles }: { user: AdminUser; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateAdminUserRoles, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  const currentCodes = new Set(user.roles.map((r) => r.code));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit Roles</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles — {user.email}</DialogTitle>
          <DialogDescription>Replaces this admin&apos;s whole role assignment. They need to sign out and back in to pick up a change.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={user.publicId} />
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles exist yet — create one under Roles &amp; Permissions first.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3">
              {roles.map((r) => (
                <label key={r.code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="roleCodes" value={r.code} defaultChecked={currentCodes.has(r.code)} className="size-4" />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save Roles'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
