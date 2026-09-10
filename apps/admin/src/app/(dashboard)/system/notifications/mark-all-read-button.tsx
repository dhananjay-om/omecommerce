'use client';

import { useActionState } from 'react';
import { markAllRead, type ActionState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: ActionState = { error: null, success: false };

export function MarkAllReadButton() {
  const [state, formAction, pending] = useActionState(markAllRead, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Marking…' : 'Mark all read'}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
