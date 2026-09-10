export interface RecordAuditLogInput {
  actorId: bigint | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRecord {
  publicId: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ListAuditLogsFilter {
  entityType?: string;
  action?: string;
  limit?: number;
}

export interface AuditLogRepository {
  record(input: RecordAuditLogInput): Promise<void>;
  list(filter: ListAuditLogsFilter): Promise<AuditLogRecord[]>;
}
