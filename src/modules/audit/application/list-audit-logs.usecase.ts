import type { AuditLogRepository, AuditLogRecord } from '../domain/repositories.js';

export interface AuditLogView {
  publicId: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function toView(r: AuditLogRecord): AuditLogView {
  return { ...r, createdAt: r.createdAt.toISOString() };
}

/** System > Audit Logs. */
export class ListAuditLogs {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  async execute(entityType?: string, action?: string, limit?: number): Promise<AuditLogView[]> {
    const rows = await this.auditLogs.list({ entityType, action, limit });
    return rows.map(toView);
  }
}
