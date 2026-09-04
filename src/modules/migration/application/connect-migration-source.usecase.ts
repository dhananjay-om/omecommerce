import type { MigrationConnectionRepository } from '../domain/repositories.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { ConnectMigrationSourceCommand, MigrationConnectionView } from './dto.js';
import { GetMigrationConnection } from './get-migration-connection.usecase.js';

/** Mirrors UpdateAiSettings exactly — apiToken is required only on the very
 *  first save for a channel, every subsequent save can omit it. */
export class ConnectMigrationSource {
  constructor(private readonly connections: MigrationConnectionRepository) {}

  async execute(cmd: ConnectMigrationSourceCommand): Promise<MigrationConnectionView> {
    const existing = await this.connections.getByChannel(cmd.channel);
    if (!existing && !cmd.apiToken) {
      throw new ValidationError('apiToken is required the first time a connection is saved', [{ path: 'apiToken', message: 'required' }]);
    }
    await this.connections.upsert({
      channel: cmd.channel,
      storeUrl: cmd.storeUrl,
      apiToken: cmd.apiToken,
      isActive: cmd.isActive,
      createdBy: null,
      updatedBy: null,
    });
    return (await new GetMigrationConnection(this.connections).execute(cmd.channel))!;
  }
}
