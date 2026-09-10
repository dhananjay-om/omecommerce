import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AuditLogRepository, RecordAuditLogInput, AuditLogRecord, ListAuditLogsFilter } from '../domain/repositories.js';

const AUDIT_LOG_SELECT = {
  publicId: true,
  actorEmail: true,
  action: true,
  entityType: true,
  entityId: true,
  summary: true,
  metadata: true,
  createdAt: true,
} as const;

type Row = {
  publicId: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: unknown;
  createdAt: Date;
};

function toRecord(row: Row): AuditLogRecord {
  return { ...row, metadata: (row.metadata as Record<string, unknown> | null) ?? null };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Db) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  }

  async list(filter: ListAuditLogsFilter): Promise<AuditLogRecord[]> {
    const rows = await this.db.auditLog.findMany({
      where: {
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.action ? { action: filter.action } : {}),
      },
      select: AUDIT_LOG_SELECT,
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 100,
    });
    return rows.map(toRecord);
  }
}
