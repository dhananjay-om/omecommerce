import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository.js';
import { PrismaActiveAdminUsersLookup } from './infrastructure/prisma-active-admin-users.js';
import { PrismaAdminUserLookup } from '../order/infrastructure/prisma-lookups.js';
import { NotifyAdmins } from './application/notify-admins.usecase.js';
import { ListMyNotifications, CountMyUnreadNotifications, MarkNotificationRead, MarkAllNotificationsRead } from './application/notification.usecases.js';
import { listNotificationsQuerySchema } from './interface/http/schemas.js';
import { NotFoundError } from '../../shared/domain/errors.js';

export interface NotificationRouters {
  admin: Router;
}

/** Worker-side composition root — src/workers/*.worker.ts and the
 *  automation module's own RunActionDeps import this directly (not the
 *  route-building createNotificationModule below), same
 *  createEmailSender(db)-shape precedent as order.module.ts. */
export function createNotifyAdminsDeps(db: Db): { notifyAdmins: NotifyAdmins } {
  const notifications = new PrismaNotificationRepository(db);
  const activeAdminUsers = new PrismaActiveAdminUsersLookup(db);
  return { notifyAdmins: new NotifyAdmins(notifications, activeAdminUsers) };
}

/** Composition root for the admin topbar bell + System > Notifications. */
export function createNotificationModule(db: Db): NotificationRouters {
  const notifications = new PrismaNotificationRepository(db);
  const adminUsers = new PrismaAdminUserLookup(db);

  const listMy = new ListMyNotifications(notifications);
  const countMyUnread = new CountMyUnreadNotifications(notifications);
  const markRead = new MarkNotificationRead(notifications);
  const markAllRead = new MarkAllNotificationsRead(notifications);

  async function resolveRecipientId(adminUserPublicId: string): Promise<bigint> {
    const user = await adminUsers.findByPublicId(adminUserPublicId);
    if (!user) throw new NotFoundError('admin user', adminUserPublicId);
    return user.id;
  }

  const admin = Router();
  // No authorize() on any route here — every authenticated admin reads/
  // writes only their own notifications, resolved from their own JWT,
  // never another admin's.
  admin.get(
    '/notifications',
    asyncHandler(async (req, res) => {
      const query = parse(listNotificationsQuerySchema, req.query);
      const recipientId = await resolveRecipientId(req.adminUser!.adminUserPublicId);
      res.json({ data: await listMy.execute(recipientId, query.unreadOnly === 'true', query.limit) });
    }),
  );
  admin.get(
    '/notifications/unread-count',
    asyncHandler(async (req, res) => {
      const recipientId = await resolveRecipientId(req.adminUser!.adminUserPublicId);
      res.json({ data: { count: await countMyUnread.execute(recipientId) } });
    }),
  );
  admin.patch(
    '/notifications/:publicId/read',
    asyncHandler(async (req, res) => {
      const recipientId = await resolveRecipientId(req.adminUser!.adminUserPublicId);
      await markRead.execute(req.params.publicId!, recipientId);
      res.status(204).send();
    }),
  );
  admin.post(
    '/notifications/mark-all-read',
    asyncHandler(async (req, res) => {
      const recipientId = await resolveRecipientId(req.adminUser!.adminUserPublicId);
      await markAllRead.execute(recipientId);
      res.status(204).send();
    }),
  );

  return { admin };
}
