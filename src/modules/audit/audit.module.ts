import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository.js';
import { ListAuditLogs } from './application/list-audit-logs.usecase.js';
import { listAuditLogsQuerySchema } from './interface/http/schemas.js';

export interface AuditRouters {
  admin: Router;
}

/** Worker/other-module-side composition root — src/modules/auth's own
 *  usecases import this directly to get an AuditLogRepository to record
 *  against, same createNotifyAdminsDeps(db)-shape precedent as the
 *  notification module. */
export function createAuditLogRepository(db: Db): PrismaAuditLogRepository {
  return new PrismaAuditLogRepository(db);
}

/** Composition root for System > Audit Logs. */
export function createAuditModule(db: Db, authorize: (permission: string) => RequestHandler): AuditRouters {
  const auditLogs = createAuditLogRepository(db);
  const listAuditLogs = new ListAuditLogs(auditLogs);

  const admin = Router();
  // Same gate as the actions this pass actually logs (Users/Roles) —
  // reading the audit trail is at least as sensitive as performing the
  // actions it records.
  admin.get(
    '/audit-logs',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const query = parse(listAuditLogsQuerySchema, req.query);
      res.json({ data: await listAuditLogs.execute(query.entityType, query.action, query.limit) });
    }),
  );

  return { admin };
}
