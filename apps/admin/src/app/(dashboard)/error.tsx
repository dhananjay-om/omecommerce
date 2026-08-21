'use client'; // Error boundaries must be Client Components (this Next.js version's error.tsx contract).

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catches any uncaught exception thrown while rendering a page inside the
 * dashboard shell — before this file existed, the admin app had ZERO error
 * boundaries anywhere, so a Server Component throwing partway through a
 * streamed response (e.g. a bad media asset key breaking presignGetUrl, or
 * any other data-shape surprise on one specific record) didn't produce a
 * normal error page at all: Next had already started streaming the layout
 * (sidebar/header) by the time the page's own data-fetch failed, and with no
 * error.tsx to catch it, the connection just got aborted — which is why it
 * showed up in the browser as a raw "This page couldn't load / A server
 * error occurred" interstitial instead of anything in-app, and with no
 * visible message pointing at the actual cause.
 *
 * Placed inside (dashboard)/ specifically (not just at the app root) so the
 * sidebar/header stay mounted and only the broken page's content area shows
 * this fallback — same reasoning app/global-error.tsx documents for the
 * root-layout-level backstop.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard page crashed:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          This page hit an unexpected error while loading. Try again, or go back to the dashboard — if it keeps
          happening, share this message with support:
        </p>
        <p className="mt-3 max-w-md break-words rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message || 'Unknown error'}
          {error.digest ? ` (digest: ${error.digest})` : null}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Link href="/dashboard" className="inline-flex">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
