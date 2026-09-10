'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { markOneRead, type ActionState } from './actions';
import type { Notification } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const initialState: ActionState = { error: null, success: false };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function NotificationRow({ notification: n }: { notification: Notification }) {
  const [, formAction, pending] = useActionState(markOneRead, initialState);

  const textBlock = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{n.title}</span>
        <Badge variant="secondary" className="text-[10px]">
          {n.category}
        </Badge>
      </div>
      <p className="mt-0.5 text-muted-foreground">{n.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
    </div>
  );

  return (
    <div className={`flex items-start gap-3 px-4 py-3 text-sm ${n.isRead ? '' : 'bg-accent/40'}`}>
      {!n.isRead ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" /> : <span className="mt-1.5 size-1.5 shrink-0" />}
      {/* A <form>/<button> can't nest inside the <a> a Link renders, so the
       *  "Mark read" action stays a sibling of the link, never inside it —
       *  invalid HTML otherwise (and the click would also trigger navigation). */}
      {n.actionHref ? (
        <Link href={n.actionHref} className="min-w-0 flex-1 hover:underline">
          {textBlock}
        </Link>
      ) : (
        textBlock
      )}
      {!n.isRead ? (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="publicId" value={n.publicId} />
          <button type="submit" disabled={pending} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            {pending ? 'Marking…' : 'Mark read'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
