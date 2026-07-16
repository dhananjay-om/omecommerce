import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
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
      <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <ShoppingBag className="size-4.5 text-primary-foreground" strokeWidth={2.25} />
          </div>
          <span className="text-lg leading-none font-bold tracking-tight">
            <span className="text-sidebar-foreground">OME</span>
            <span className="text-primary">commerce</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <DashboardNav />
        </div>
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-[11px] font-medium tracking-wider text-sidebar-foreground/35 uppercase">
            OrangeMantra · OMEcommerce
          </p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
