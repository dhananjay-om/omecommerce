import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { getCatalogMigrationQueue } from '../../../shared/infrastructure/queue/queues.js';
import type { MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

/** Applies the plan a prior AnalyzeCatalog call already built — this is the
 *  single click the whole "no manual intervention" requirement is about,
 *  it never re-analyzes or asks for field-by-field confirmation. */
export class StartCatalogMigration {
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

    const job = await getCatalogMigrationQueue().add('migrate-catalog', { runId: run.id.toString() });
    await this.runs.markStarted(run.id, job.id!);

    return toMigrationRunView((await this.runs.findById(run.id))!, connection.channel);
  }
}
