'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshInsightsNow, type RefreshState } from './actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const initialState: RefreshState = { error: null, success: false };

/** Runs the same rule engine as the 02:30 UTC nightly job, on demand — for
 *  right after a deploy/seed, or just to see today's numbers without
 *  waiting overnight. Not a live "always current" button — click it again
 *  any time you want a fresh read. */
export function RefreshInsightsButton() {
  const [state, formAction, pending] = useActionState(refreshInsightsNow, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw className={cn('size-3.5', pending && 'animate-spin')} />
        {pending ? 'Refreshing…' : 'Refresh now'}
      </Button>
    </form>
  );
}
