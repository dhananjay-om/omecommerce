'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Static shell for Phase 0 — there's no persistent notification model yet
 * (see the "Notifications" System nav item's own `ComingSoon` page); this
 * gives the topbar the mock's bell icon and an honest empty state rather
 * than faking unread items that don't correspond to anything real.
 */
export function NotificationsPopover() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Notifications" />}>
        <Bell className="size-4" />
      </PopoverTrigger>
      <PopoverContent>
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</div>
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          A persistent notification center is on the roadmap — see System &gt; Notifications.
        </div>
      </PopoverContent>
    </Popover>
  );
}
