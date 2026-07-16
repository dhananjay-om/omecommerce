import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';
import { DashboardNav } from '@/components/dashboard-nav';
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
      <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <span className="text-xl leading-none font-bold tracking-tight">
            <span className="text-primary">orange</span>
            <span className="text-sidebar-foreground">mantra</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <DashboardNav />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" strokeWidth={2} />
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
