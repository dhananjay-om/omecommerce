import type { MigrationConnectionRepository, MigrationRunRepository, MigrationChannel } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { MigrationRunView } from './dto.js';
import { toMigrationRunView } from './migration-run-view.js';

const DEFAULT_LIMIT = 20;

export class ListMigrationRuns {
  constructor(
    private readonly connections: MigrationConnectionRepository,
    private readonly runs: MigrationRunRepository,
  ) {}

  /** `dataType` is optional — the Catalog and Customer migration pages each
   *  pass their own, so a customer run never shows up as "the latest run"
   *  on the Catalog page or vice versa (they share one connection, but each
   *  has its own independent Check Migration / Start / Stop history). */
  async execute(channel: MigrationChannel, dataType?: string): Promise<MigrationRunView[]> {
    const connection = await this.connections.getByChannel(channel);
    if (!connection) throw new NotFoundError('migration connection', channel);
    const rows = await this.runs.listByConnectionId(connection.id, DEFAULT_LIMIT, dataType);
    return rows.map((r) => toMigrationRunView(r, channel));
  }
}
