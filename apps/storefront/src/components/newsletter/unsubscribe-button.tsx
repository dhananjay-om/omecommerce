'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type State = 'idle' | 'loading' | 'done' | { error: string };

/** Unsubscribing is a deliberate button press (POST), not something the page
 *  does on load — mail scanners that pre-fetch links in an email must not be
 *  able to unsubscribe people by accident. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<State>('idle');

  async function unsubscribe() {
    setState('loading');
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setState(res.ok ? 'done' : { error: json.error ?? 'Something went wrong. Please try again.' });
    } catch {
      setState({ error: 'Network error. Please try again.' });
    }
  }

  if (state === 'done') {
    return <p className="mt-6 text-sm text-green-700">You&apos;ve been unsubscribed. You won&apos;t receive any more newsletters.</p>;
  }
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <Button onClick={unsubscribe} disabled={state === 'loading'} variant="cta">
        {state === 'loading' ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
      </Button>
      {typeof state === 'object' ? <p role="alert" className="text-sm text-rose">{state.error}</p> : null}
    </div>
  );
}
