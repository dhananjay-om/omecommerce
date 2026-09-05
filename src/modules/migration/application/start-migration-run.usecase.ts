import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { getCatalogMigrationQueue } from '../../../shared/infrastructure/queue/queues.js';
import type { MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

const JOB_NAME_BY_DATA_TYPE: Record<string, string> = {
  CUSTOMER: 'migrate-customers',
  ORDER: 'migrate-orders',
};

/** Applies the plan a prior AnalyzeCatalog/AnalyzeCustomers/AnalyzeOrders
 *  call already built — this is the single click the whole "no manual
 *  intervention" requirement is about, it never re-analyzes or asks for
 *  field-by-field confirmation. Dispatches to the right BullMQ job name by
 *  the run's own `dataType` (all three job types share one queue — see
 *  queues.ts's own doc comment on why — and are handled by the one Worker
 *  in catalog-migration.worker.ts, which dispatches by job name the same
 *  way bulk-import.worker.ts's own Worker already dispatches multiple job
 *  types on BULK_JOBS_QUEUE). */
export class StartMigrationRun {
  constructor(
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  async execute(runPublicId: string): Promise<MigrationRunView> {
    const run = await this.runs.findByPublicId(runPublicId);
    if (!run) throw new NotFoundError('migration run', runPublicId);
    if (run.status !== 'READY') {
      throw new ValidationError(`this run is ${run.status.toLowerCase()}, not ready to start`, [{ path: 'status', message: 'must be READY' }]);
    }
    const connection = await this.connections.getById(run.connectionId);
    if (!connection) throw new NotFoundError('migration connection', run.connectionId.toString());

    const jobName = JOB_NAME_BY_DATA_TYPE[run.dataType] ?? 'migrate-catalog';
    const job = await getCatalogMigrationQueue().add(jobName, { runId: run.id.toString() });
    await this.runs.markStarted(run.id, job.id!);

    return toMigrationRunView((await this.runs.findById(run.id))!, connection.channel);
  }
}
