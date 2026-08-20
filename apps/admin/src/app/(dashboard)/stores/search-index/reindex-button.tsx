'use client';

import { useActionState } from 'react';
import { reindexSearch, type ReindexActionState } from './actions';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const initialState: ReindexActionState = { error: null, result: null };

/**
 * A full reindex is the fix for any "the storefront doesn't reflect what's
 * in the admin yet" symptom — a stale price, a missing image, a product
 * that doesn't show up in search/PLP/featured carousels. It recomputes
 * every product's search document fresh from the current database and
 * cleans up any orphaned document left behind by e.g. a raw DB edit that
 * bypassed the normal delete flow (see ReindexAll's own doc comment).
 */
export function ReindexButton() {
  const [state, formAction, pending] = useActionState(reindexSearch, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Button type="submit" disabled={pending}>
        <RefreshCw className={pending ? 'size-4 animate-spin' : 'size-4'} />
        {pending ? 'Reindexing…' : 'Reindex Now'}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.result ? (
        <p className="text-sm text-muted-foreground">
          Indexed <span className="font-medium text-foreground">{state.result.indexed}</span> product
          {state.result.indexed === 1 ? '' : 's'}
          {state.result.removed > 0 ? (
            <>
              , removed <span className="font-medium text-foreground">{state.result.removed}</span> orphaned
              entr{state.result.removed === 1 ? 'y' : 'ies'}
            </>
          ) : null}{' '}
          — last run at {new Date(state.result.ranAt).toLocaleTimeString()}.
        </p>
      ) : null}
    </form>
  );
}
