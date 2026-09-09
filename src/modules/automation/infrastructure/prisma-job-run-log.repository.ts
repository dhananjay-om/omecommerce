import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { JobRunLogRepository, JobRunLogView, JobRunStatus } from '../domain/repositories.js';

export class PrismaJobRunLogRepository implements JobRunLogRepository {
  constructor(private readonly db: Db) {}

  async recordStart(jobName: string): Promise<bigint> {
    const row = await this.db.jobRunLog.create({
      data: { jobName, startedAt: new Date(), status: 'RUNNING' },
    });
    return row.id;
  }

  async recordFinish(id: bigint, status: 'SUCCEEDED' | 'FAILED', errorMessage?: string | null): Promise<void> {
    await this.db.jobRunLog.update({
      where: { id },
      data: { status, finishedAt: new Date(), errorMessage: errorMessage ?? null },
    });
  }

  async listRecent(jobName: string, limit: number): Promise<JobRunLogView[]> {
    const rows = await this.db.jobRunLog.findMany({
      where: { jobName },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return rows.map(toView);
  }

  async lastRun(jobName: string): Promise<JobRunLogView | null> {
    const row = await this.db.jobRunLog.findFirst({
      where: { jobName },
      orderBy: { startedAt: 'desc' },
    });
    return row ? toView(row) : null;
  }
}

function toView(row: { id: bigint; jobName: string; startedAt: Date; finishedAt: Date | null; status: string; errorMessage: string | null }): JobRunLogView {
  return {
    id: row.id,
    jobName: row.jobName,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status as JobRunStatus,
    errorMessage: row.errorMessage,
  };
}
