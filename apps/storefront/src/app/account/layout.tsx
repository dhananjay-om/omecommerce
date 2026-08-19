import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { apiGet, ApiError } from '@/lib/api-client';
import { AccountNav } from '@/components/account/account-nav';

/**
 * Gates every /account/* route in one place. requireSession() only proves
 * the session COOKIE exists, not that the token is still valid — a stale
 * cookie (routine: the cookie outlives the backend's undocumented JWT TTL by
 * design, per session.ts's own header comment) would otherwise reach every
 * individual page's data fetch and 500 there instead of redirecting to
 * /login cleanly. Proving it here, once, at the shared gate, is cheaper and
 * far less error-prone than every current and future /account/* page
 * remembering to catch a 401 itself.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  try {
    await apiGet('/store/v1/me', { auth: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Account</h1>
      <div className="flex flex-col gap-8 md:flex-row">
        <AccountNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
