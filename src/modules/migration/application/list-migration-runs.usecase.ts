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

  async execute(channel: MigrationChannel): Promise<MigrationRunView[]> {
    const connection = await this.connections.getByChannel(channel);
    if (!connection) throw new NotFoundError('migration connection', channel);
    const rows = await this.runs.listByConnectionId(connection.id, DEFAULT_LIMIT);
    return rows.map((r) => toMigrationRunView(r, channel));
  }
}
