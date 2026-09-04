import type { MigrationConnectionRepository, MigrationRunRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

/**
 * "Stop" — requests a cooperative cancel of a RUNNING migration. Never a
 * hard kill: the worker's own per-product loop checks this flag and stops
 * between products, so nothing is ever left half-created (see the worker's
 * own doc comment). Whatever ran before the stop stays real and stays —
 * re-running Check Migration + Start afterward picks up exactly where it
 * left off (the same MigrationExternalRef-based idempotency that makes any
 * re-run safe).
 */
export class CancelMigrationRun {
  constructor(
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  async execute(runPublicId: string): Promise<MigrationRunView> {
    const run = await this.runs.findByPublicId(runPublicId);
    if (!run) throw new NotFoundError('migration run', runPublicId);
    if (run.status !== 'RUNNING') {
      throw new ValidationError(`this run is ${run.status.toLowerCase()}, not running`, [{ path: 'status', message: 'must be RUNNING' }]);
    }
    const connection = await this.connections.getById(run.connectionId);
    if (!connection) throw new NotFoundError('migration connection', run.connectionId.toString());

    await this.runs.requestCancel(run.id);
    return toMigrationRunView((await this.runs.findById(run.id))!, connection.channel);
  }
}
