import { Job } from 'bullmq';
import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { getCatalogMigrationQueue } from '../../../shared/infrastructure/queue/queues.js';
import type { MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

interface JobProgress {
  processed?: number;
  skipped?: number;
  failed?: number;
  total?: number;
}

/** Poll target for the admin's progress bar. While RUNNING, BullMQ's own
 *  live job.progress (updated after every product — see the worker's own
 *  doc comment) is fresher than the DB row (updated only every few
 *  products), so it wins when reachable; the DB row is the fallback and is
 *  always authoritative once COMPLETED/FAILED. */
export class GetMigrationRun {
  constructor(
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  async execute(runPublicId: string): Promise<MigrationRunView> {
    const run = await this.runs.findByPublicId(runPublicId);
    if (!run) throw new NotFoundError('migration run', runPublicId);
    const connection = await this.connections.getById(run.connectionId);
    if (!connection) throw new NotFoundError('migration connection', run.connectionId.toString());

    let view = toMigrationRunView(run, connection.channel);
    if (run.status === 'RUNNING' && run.jobId) {
      const job = await Job.fromId(getCatalogMigrationQueue(), run.jobId).catch(() => null);
      const progress = job?.progress as JobProgress | undefined;
      if (progress && typeof progress === 'object') {
        view = {
          ...view,
          processedItems: progress.processed ?? view.processedItems,
          skippedItems: progress.skipped ?? view.skippedItems,
          failedItems: progress.failed ?? view.failedItems,
          totalItems: progress.total ?? view.totalItems,
        };
      }
    }
    return view;
  }
}
