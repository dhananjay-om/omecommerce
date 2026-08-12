'use client';

import { useActionState, useState } from 'react';
import { addOrderNote, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const initialState: ActionState = { error: null, success: false };

export function AddNoteForm({ orderPublicId }: { orderPublicId: string }) {
  const action = addOrderNote.bind(null, orderPublicId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handledState, setHandledState] = useState(state);
  const [bodyKey, setBodyKey] = useState(0);

  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setBodyKey((k) => k + 1); // clears the textarea's uncontrolled defaultValue
  }

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <select name="type" defaultValue="INTERNAL" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none">
          <option value="INTERNAL">Internal note</option>
          <option value="CUSTOMER">Customer-visible note</option>
        </select>
      </div>
      <Textarea key={bodyKey} name="body" placeholder="Add a note…" rows={2} required />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add Note'}
      </Button>
    </form>
  );
}
