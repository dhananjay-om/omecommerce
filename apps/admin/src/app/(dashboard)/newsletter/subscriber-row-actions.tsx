'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setSubscriberStatus, deleteSubscriber } from './actions';

export function SubscriberRowActions({ publicId, email, status }: { publicId: string; email: string; status: 'SUBSCRIBED' | 'UNSUBSCRIBED' }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<string | null>) {
    setError(null);
    startTransition(async () => setError(await fn()));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setSubscriberStatus(publicId, status === 'SUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED'))}
        >
          {status === 'SUBSCRIBED' ? 'Unsubscribe' : 'Resubscribe'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (window.confirm(`Permanently delete ${email} from the list? This can't be undone.`)) run(() => deleteSubscriber(publicId));
          }}
        >
          Delete
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
