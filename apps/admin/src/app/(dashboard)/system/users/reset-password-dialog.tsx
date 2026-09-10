'use client';

import { useActionState, useState } from 'react';
import { resetAdminUserPassword, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

export function ResetPasswordDialog({ publicId, email }: { publicId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resetAdminUserPassword, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Reset Password</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password — {email}</DialogTitle>
          <DialogDescription>Sets their password directly — there&apos;s no self-service reset yet, so share the new one with them yourself.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={publicId} />
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <Input id="rp-password" name="newPassword" type="password" required minLength={8} placeholder="At least 8 characters" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Set New Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
