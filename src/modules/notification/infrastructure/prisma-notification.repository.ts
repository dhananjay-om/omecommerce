import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { NotificationRepository, NotificationRecord, CreateNotificationInput, ListNotificationsFilter, NotificationCategory } from '../domain/repositories.js';

const NOTIFICATION_SELECT = {
  publicId: true,
  category: true,
  title: true,
  message: true,
  actionHref: true,
  isRead: true,
  createdAt: true,
} as const;

type Row = {
  publicId: string;
  category: string;
  title: string;
  message: string;
  actionHref: string | null;
  isRead: boolean;
  createdAt: Date;
};

function toRecord(row: Row): NotificationRecord {
  return { ...row, category: row.category as NotificationCategory };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Db) {}

  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.db.notification.createMany({
      data: inputs.map((i) => ({
        recipientId: i.recipientId,
        category: i.category,
        title: i.title,
        message: i.message,
        actionHref: i.actionHref ?? null,
      })),
    });
  }

  async listForRecipient(recipientId: bigint, filter: ListNotificationsFilter): Promise<NotificationRecord[]> {
    const rows = await this.db.notification.findMany({
      where: { recipientId, ...(filter.unreadOnly ? { isRead: false } : {}) },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
    });
    return rows.map(toRecord);
  }

  async countUnread(recipientId: bigint): Promise<number> {
    return this.db.notification.count({ where: { recipientId, isRead: false } });
  }

  async markRead(publicId: string, recipientId: bigint): Promise<boolean> {
    const { count } = await this.db.notification.updateMany({
      where: { publicId, recipientId },
      data: { isRead: true, readAt: new Date() },
    });
    return count > 0;
  }

  async markAllRead(recipientId: bigint): Promise<void> {
    await this.db.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
