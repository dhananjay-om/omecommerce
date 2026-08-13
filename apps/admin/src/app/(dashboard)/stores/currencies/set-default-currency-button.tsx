'use client';

import { useActionState } from 'react';
import { setDefaultCurrency, type ActionState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: ActionState = { error: null, success: false };

/** One-click, no dialog — there's nothing to confirm/type, and the resulting
 *  state (which currency is default) is immediately visible in the table. */
export function SetDefaultCurrencyButton({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(setDefaultCurrency, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="code" value={code} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Setting…' : 'Set as Default'}
      </Button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
