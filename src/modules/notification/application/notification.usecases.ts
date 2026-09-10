import type { NotificationRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export interface NotificationView {
  publicId: string;
  category: string;
  title: string;
  message: string;
  actionHref: string | null;
  isRead: boolean;
  createdAt: string;
}

function toView(n: { publicId: string; category: string; title: string; message: string; actionHref: string | null; isRead: boolean; createdAt: Date }): NotificationView {
  return { ...n, createdAt: n.createdAt.toISOString() };
}

/** The bell popover + System > Notifications page — always scoped to
 *  the caller's own recipientId, resolved by the route from the
 *  authenticated admin's publicId (no special permission needed, every
 *  admin may read their own notifications). */
export class ListMyNotifications {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(recipientId: bigint, unreadOnly: boolean, limit?: number): Promise<NotificationView[]> {
    const rows = await this.notifications.listForRecipient(recipientId, { unreadOnly, limit });
    return rows.map(toView);
  }
}

export class CountMyUnreadNotifications {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(recipientId: bigint): Promise<number> {
    return this.notifications.countUnread(recipientId);
  }
}

export class MarkNotificationRead {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(publicId: string, recipientId: bigint): Promise<void> {
    const found = await this.notifications.markRead(publicId, recipientId);
    if (!found) throw new NotFoundError('notification', publicId);
  }
}

export class MarkAllNotificationsRead {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(recipientId: bigint): Promise<void> {
    await this.notifications.markAllRead(recipientId);
  }
}
