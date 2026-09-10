/** 'ALERT' | 'AUTOMATION' — fixed vocabulary in app code, matches the two
 *  real trigger sources wired up (see NotifyAdmins' own doc comment). */
export type NotificationCategory = 'ALERT' | 'AUTOMATION';

export interface NotificationRecord {
  publicId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionHref: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  recipientId: bigint;
  category: NotificationCategory;
  title: string;
  message: string;
  actionHref?: string | null;
}

export interface ListNotificationsFilter {
  unreadOnly?: boolean;
  limit?: number;
}

export interface NotificationRepository {
  /** Fan-out insert — one row per recipient, same write for a "broadcast"
   *  as for a single-recipient notification (there's no distinct code
   *  path for either — see notification.prisma's own header comment). */
  createMany(inputs: CreateNotificationInput[]): Promise<void>;
  listForRecipient(recipientId: bigint, filter: ListNotificationsFilter): Promise<NotificationRecord[]>;
  countUnread(recipientId: bigint): Promise<number>;
  /** Ownership-checked — a publicId that exists but belongs to a
   *  different recipient behaves exactly like one that doesn't exist at
   *  all (returns false), same "404, never 403, never leak existence"
   *  posture as the storefront's own customer-scoped routes. */
  markRead(publicId: string, recipientId: bigint): Promise<boolean>;
  markAllRead(recipientId: bigint): Promise<void>;
}

/** Every active, non-deleted admin user's internal id — the recipient
 *  set a "notify every admin" call fans out to. Its own small port
 *  (not importing the auth module's own repository) — same
 *  cross-module-read-only-lookup precedent as
 *  order/infrastructure/prisma-lookups.ts's PrismaAdminUserLookup,
 *  reused by wallet/automation for the same reason: a thin read, not a
 *  reason to couple two modules together. */
export interface ActiveAdminUsersLookup {
  listIds(): Promise<bigint[]>;
}
