'use client';

import { useState, type FormEvent } from 'react';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'success' } | { kind: 'already' } | { kind: 'error'; message: string };

/** Shared by every newsletter form (home section, footer) so they behave the
 *  same: POST the address to the same-origin proxy route, show a real result. */
export function useNewsletterSubscribe(source: string) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), website: data.get('website'), source }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; alreadySubscribed?: boolean };
      if (!res.ok) {
        setState({ kind: 'error', message: json.error ?? 'Something went wrong. Please try again.' });
        return;
      }
      form.reset();
      setState({ kind: json.alreadySubscribed ? 'already' : 'success' });
    } catch {
      setState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  return { state, onSubmit, loading: state.kind === 'loading' };
}
