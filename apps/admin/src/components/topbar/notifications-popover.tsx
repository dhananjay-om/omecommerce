'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getUnreadNotificationCount, listRecentNotifications, markNotificationRead, markAllNotificationsRead } from './notifications-actions';
import type { Notification } from '@/lib/types';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * A real, persisted notification center — replaces the earlier static
 * Phase-0 shell now that `notification` exists. No real-time push (no
 * WebSocket/SSE exists anywhere in this codebase to build on) — polls
 * the unread count every ~30s via a server action, same "server action,
 * not a raw browser fetch to the API host" pattern every other admin
 * page already uses. The recent list is only fetched when the popover
 * actually opens, not on every poll tick.
 */
export function NotificationsPopover() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const count = await getUnreadNotificationCount();
      if (!cancelled) setUnreadCount(count);
    }
    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLoading(true);
      const [list, count] = await Promise.all([listRecentNotifications(), getUnreadNotificationCount()]);
      setItems(list);
      setUnreadCount(count);
      setLoading(false);
    }
  }

  async function handleItemClick(n: Notification) {
    if (!n.isRead) {
      await markNotificationRead(n.publicId);
      setItems((prev) => prev?.map((x) => (x.publicId === n.publicId ? { ...x, isRead: true } : x)) ?? null);
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? null);
    setUnreadCount(0);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} className="relative" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 ? (
            <button type="button" onClick={() => void handleMarkAllRead()} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !items || items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing yet.</div>
          ) : (
            items.map((n) => {
              const body = (
                <div className={`flex items-start gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0 ${n.isRead ? '' : 'bg-accent/40'}`}>
                  {!n.isRead ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" /> : <span className="mt-1.5 size-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant="secondary" className="text-[9px]">
                        {n.category}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.actionHref ? (
                <Link key={n.publicId} href={n.actionHref} onClick={() => void handleItemClick(n)} className="block hover:bg-accent/60">
                  {body}
                </Link>
              ) : (
                <button key={n.publicId} type="button" onClick={() => void handleItemClick(n)} className="block w-full text-left hover:bg-accent/60">
                  {body}
                </button>
              );
            })
          )}
        </div>
        <Link href="/system/notifications" className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground">
          View all
        </Link>
      </PopoverContent>
    </Popover>
  );
}
