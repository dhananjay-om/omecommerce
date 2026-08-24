import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import type { Website } from '@/lib/types';
import { AppSidebar } from '@/components/app-sidebar';
import { TopHeader } from '@/components/top-header';
import { Toaster } from '@/components/ui/sonner';
import { SITE_URL } from '@/lib/config';

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

  // Best-effort — the topbar's store-switcher chip is informational chrome
  // (see StoreSwitcherChip's own comment), not load-bearing for the page,
  // so a transient failure here shouldn't take down the whole shell.
  const websiteNames = await apiGet<Website[]>('/admin/v1/websites')
    .then((sites) => sites.map((s) => s.name))
    .catch(() => []);

  return (
    <div className="flex h-screen bg-bg-page">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader siteUrl={SITE_URL} websiteNames={websiteNames} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1560px] p-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
