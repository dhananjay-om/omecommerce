import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';
import { DashboardNav } from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

/**
 * Best-effort UX redirect for the common "never logged in" case — fast path
 * so a fully logged-out visitor doesn't see a flash of dashboard chrome
 * before being bounced. This is NOT the real enforcement: per Next.js's own
 * authentication guide, layouts don't re-run on client-side navigation
 * (partial rendering), so a session that expires mid-visit wouldn't be
 * caught here on a later navigation. The real check lives in
 * lib/api-client.ts's requireSession() call, which runs on every actual data
 * fetch, not just once per layout mount.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/20 p-4">
        <div className="mb-6 px-3 text-lg font-semibold">OMEcommerce</div>
        <DashboardNav />
        <div className="mt-auto pt-4">
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
      <Toaster />
    </div>
  );
}
