import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  MigrationRunRepository,
  MigrationRunInfo,
  CreateMigrationRunInput,
  MigrationRunStatus,
} from '../domain/repositories.js';

export class PrismaMigrationRunRepository implements MigrationRunRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateMigrationRunInput): Promise<MigrationRunInfo> {
    const row = await this.db.migrationRun.create({
      data: {
        connectionId: input.connectionId,
        dataType: input.dataType,
        status: 'READY',
        totalItems: input.totalItems,
        planJson: input.planJson as object,
        createdBy: input.createdBy,
      },
    });
    return toInfo(row);
  }

  async findByPublicId(publicId: string): Promise<MigrationRunInfo | null> {
    const row = await this.db.migrationRun.findUnique({ where: { publicId } });
    return row ? toInfo(row) : null;
  }

  async findById(id: bigint): Promise<MigrationRunInfo | null> {
    const row = await this.db.migrationRun.findUnique({ where: { id } });
    return row ? toInfo(row) : null;
  }

  async listByConnectionId(connectionId: bigint, limit: number, dataType?: string): Promise<MigrationRunInfo[]> {
    const rows = await this.db.migrationRun.findMany({
      where: { connectionId, ...(dataType ? { dataType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toInfo);
  }

  async markStarted(id: bigint, jobId: string): Promise<void> {
    await this.db.migrationRun.update({ where: { id }, data: { status: 'RUNNING', jobId, startedAt: new Date() } });
  }

  async updateProgress(id: bigint, processedItems: number, skippedItems: number, failedItems: number): Promise<void> {
    await this.db.migrationRun.update({ where: { id }, data: { processedItems, skippedItems, failedItems } });
  }

  async markCompleted(id: bigint, resultJson: unknown): Promise<void> {
    await this.db.migrationRun.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), resultJson: resultJson as object },
    });
  }

  async markFailed(id: bigint, resultJson: unknown): Promise<void> {
    await this.db.migrationRun.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date(), resultJson: resultJson as object },
    });
  }

  async requestCancel(id: bigint): Promise<void> {
    await this.db.migrationRun.update({ where: { id }, data: { cancelRequested: true } });
  }

  async isCancelRequested(id: bigint): Promise<boolean> {
    const row = await this.db.migrationRun.findUnique({ where: { id }, select: { cancelRequested: true } });
    return row?.cancelRequested ?? false;
  }

  async markCancelled(id: bigint, resultJson: unknown): Promise<void> {
    await this.db.migrationRun.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date(), resultJson: resultJson as object },
    });
  }
}

function toInfo(row: {
  id: bigint;
  publicId: string;
  connectionId: bigint;
  dataType: string;
  status: string;
  jobId: string | null;
  cancelRequested: boolean;
  totalItems: number | null;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  planJson: unknown;
  resultJson: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): MigrationRunInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    connectionId: row.connectionId,
    dataType: row.dataType,
    status: row.status as MigrationRunStatus,
    jobId: row.jobId,
    cancelRequested: row.cancelRequested,
    totalItems: row.totalItems,
    processedItems: row.processedItems,
    skippedItems: row.skippedItems,
    failedItems: row.failedItems,
    planJson: row.planJson,
    resultJson: row.resultJson,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}
