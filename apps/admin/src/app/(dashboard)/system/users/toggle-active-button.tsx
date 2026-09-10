'use client';

import { useActionState, useState } from 'react';
import { setAdminUserActive, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const initialState: ActionState = { error: null, success: false };

/** Reactivate is a plain one-click form (restorative, not destructive).
 *  Deactivate is wrapped in a confirm dialog and is unavailable for the
 *  admin's own account — the backend rejects it too (a real guard, not
 *  just a UI nicety), but hiding the button avoids a confusing error. */
export function ToggleActiveButton({ publicId, email, isActive, isSelf }: { publicId: string; email: string; isActive: boolean; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(setAdminUserActive, initialState);

  if (isActive) {
    if (isSelf) {
      return (
        <Button variant="outline" size="sm" disabled title="You can't deactivate your own account.">
          Deactivate
        </Button>
      );
    }
    return <DeactivateDialog publicId={publicId} email={email} />;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="isActive" value="true" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Reactivating…' : 'Reactivate'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

function DeactivateDialog({ publicId, email }: { publicId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setAdminUserActive, initialState);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Deactivate</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {email}?</DialogTitle>
          <DialogDescription>They&apos;ll be unable to log in until reactivated. Nothing they&apos;ve already done is affected.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="publicId" value={publicId} />
          <input type="hidden" name="isActive" value="false" />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
