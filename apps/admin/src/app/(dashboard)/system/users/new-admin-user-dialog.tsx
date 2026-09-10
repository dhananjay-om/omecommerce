'use client';

import { useActionState, useState } from 'react';
import { createAdminUser, type ActionState } from './actions';
import type { Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** No email-invite/magic-link flow exists for admin accounts — this sets
 *  the initial password directly, same as CreateAdminUser's own usecase
 *  always has, and shares it with the new team member out of band. */
export function NewAdminUserDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAdminUser, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New User</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Admin User</DialogTitle>
          <DialogDescription>
            Sets an initial password directly — there&apos;s no email-invite flow yet, so share it with them
            yourself. They can change it once Reset Password ships a self-service option.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="au-email">Email</Label>
            <Input id="au-email" name="email" type="email" required placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-password">Initial password</Label>
            <Input id="au-password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles exist yet — create one under Roles &amp; Permissions first.</p>
            ) : (
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3">
                {roles.map((r) => (
                  <label key={r.code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="roleCodes" value={r.code} className="size-4" />
                    {r.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
