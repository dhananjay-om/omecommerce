'use client';

import { useActionState } from 'react';
import { syncPermissions, type SyncPermissionsActionState } from './actions';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

const initialState: SyncPermissionsActionState = { error: null, result: null };

export function SyncPermissionsButton() {
  const [state, formAction, pending] = useActionState(syncPermissions, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Button type="submit" disabled={pending}>
        <ShieldCheck className="size-4" />
        {pending ? 'Syncing…' : 'Sync Permissions'}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.result ? (
        <div className="text-sm text-muted-foreground">
          <p>
            {state.result.grantsAdded > 0 ? (
              <>
                Granted <span className="font-medium text-foreground">{state.result.grantsAdded}</span> new
                permission{state.result.grantsAdded === 1 ? '' : 's'} to Super Admin
                {' '}({state.result.permissionsRegistered} total registered).
              </>
            ) : (
              <>Already up to date — all {state.result.permissionsRegistered} permissions are granted.</>
            )}
          </p>
          {state.result.grantsAdded > 0 ? (
            <p className="mt-1 font-medium text-foreground">
              Log out and back in to pick up the new access — permissions are set at login, not live.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
