'use client';

import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { sectionLabelForPath } from '@/components/dashboard-nav';

/** siteUrl is passed down from layout.tsx (a Server Component — see its own
 *  comment) rather than read here directly: it comes from a plain, non-
 *  `NEXT_PUBLIC_` env var (lib/config.ts), which only resolves correctly on
 *  the server. */
export function TopHeader({ siteUrl }: { siteUrl: string }) {
  const pathname = usePathname();
  const label = sectionLabelForPath(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-8">
      <span className="text-sm text-muted-foreground">
        Admin <span className="text-foreground">/ {label}</span>
      </span>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" render={<a href={siteUrl} target="_blank" rel="noreferrer" />}>
          View Store
          <ExternalLink className="size-3.5" />
        </Button>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          A
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">Admin</span>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
