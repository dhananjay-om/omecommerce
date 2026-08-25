'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshForecastsNow, type RefreshState } from './actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const initialState: RefreshState = { error: null, success: false };

/** Mirrors ai/insights/refresh-button.tsx's RefreshInsightsButton exactly. */
export function RefreshForecastsButton() {
  const [state, formAction, pending] = useActionState(refreshForecastsNow, initialState);

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
