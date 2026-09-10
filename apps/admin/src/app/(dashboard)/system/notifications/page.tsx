import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MarkAllReadButton } from './mark-all-read-button';
import { NotificationRow } from './notification-row';

const TABS = [
  { value: 'unread', label: 'Unread' },
  { value: 'all', label: 'All' },
] as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const unreadOnly = filter !== 'all';

  const notifications = await apiGet<Notification[]>(`/admin/v1/notifications?limit=100${unreadOnly ? '&unreadOnly=true' : ''}`);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real alerts and rule-fired events — see the bell in the topbar for a quick view. No real-time push (this
            list is what actually happened, not a live feed) — refresh to see new ones.
          </p>
        </div>
        {unreadCount > 0 ? <MarkAllReadButton /> : null}
      </div>

      <div className="mt-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === 'unread' ? '/system/notifications' : `/system/notifications?filter=${t.value}`}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              (t.value === 'unread' ? unreadOnly : !unreadOnly) ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-md border">
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {unreadOnly ? "You're all caught up." : 'Nothing yet.'}
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <NotificationRow key={n.publicId} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
