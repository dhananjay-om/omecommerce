'use client';

import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { sectionLabelForPath } from '@/lib/nav-data';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/topbar/command-palette';
import { AskAiButton } from '@/components/topbar/ask-ai-button';
import { NotificationsPopover } from '@/components/topbar/notifications-popover';
import { ThemeToggle } from '@/components/topbar/theme-toggle';
import { AvatarMenu } from '@/components/topbar/avatar-menu';

/** siteUrl is passed down from layout.tsx (a Server Component — see its own
 *  comment) rather than read here directly: it comes from a plain, non-
 *  `NEXT_PUBLIC_` env var (lib/config.ts), which only resolves correctly on
 *  the server. */
export function TopHeader({ siteUrl }: { siteUrl: string }) {
  const pathname = usePathname();
  const label = sectionLabelForPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
      <CommandPalette />

      <div className="ml-auto flex items-center gap-1.5">
        <AskAiButton />
        <NotificationsPopover />
        <ThemeToggle />
        <Button variant="ghost" size="sm" render={<a href={siteUrl} target="_blank" rel="noreferrer" />}>
          View Store
          <ExternalLink className="size-3.5" />
        </Button>
        <AvatarMenu />
      </div>

      {/* Breadcrumb text is kept for screen readers / the browser tab title
          context, visually secondary now that search anchors the topbar
          (same "Admin / {section}" source as before — sectionLabelForPath
          now reads off nav-data.ts instead of dashboard-nav.tsx). */}
      <span className="sr-only">Admin / {label}</span>
    </header>
  );
}
