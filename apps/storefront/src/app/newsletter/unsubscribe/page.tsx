import type { Metadata } from 'next';
import Link from 'next/link';
import { UnsubscribeButton } from '@/components/newsletter/unsubscribe-button';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold text-jet">Unsubscribe from our newsletter</h1>
      {token ? (
        <>
          <p className="mt-3 text-sm text-slate">Sorry to see you go. Confirm below and we&apos;ll stop sending you newsletters.</p>
          <UnsubscribeButton token={token} />
        </>
      ) : (
        <p className="mt-4 text-sm text-slate">This unsubscribe link is incomplete. Please use the link from the bottom of the email.</p>
      )}
      <Link href="/" className="mt-8 inline-block text-sm text-champagne underline">
        Back to the store
      </Link>
    </div>
  );
}
