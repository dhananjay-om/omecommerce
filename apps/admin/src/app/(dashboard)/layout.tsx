import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { getSession } from '@/lib/session';
import { DashboardNav } from '@/components/dashboard-nav';
import { TopHeader } from '@/components/top-header';
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
    <div className="flex min-h-screen bg-muted/30">
      <aside className="relative z-30 flex w-20 flex-col items-center bg-sidebar text-sidebar-foreground">
        <Link href="/dashboard" className="flex h-16 w-full items-center justify-center" title="OMEcommerce">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <ShoppingBag className="size-4.5 text-primary-foreground" strokeWidth={2.25} />
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto py-2">
          <DashboardNav />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
