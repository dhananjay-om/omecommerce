import type { MigrationConnectionRepository, MigrationChannel } from '../domain/repositories.js';
import { DomainError, NotFoundError } from '../../../shared/domain/errors.js';
import { buildSourceClient } from '../infrastructure/source-client-factory.js';

/** Mirrors TestAiConnection/SendTestEmail exactly — calls the real source
 *  API's cheapest proof-of-life endpoint, re-throws a real failure rather
 *  than swallowing it. */
export class TestMigrationConnection {
  constructor(private readonly connections: MigrationConnectionRepository) {}

  async execute(channel: MigrationChannel): Promise<{ storeName?: string }> {
    const connection = await this.connections.getByChannel(channel);
    if (!connection) throw new NotFoundError('migration connection', channel);

    const client = buildSourceClient(channel, connection.storeUrl, connection.apiToken);
    const result = await client.testConnection();
    if (!result.ok) {
      throw new DomainError(result.message, 'https://errors.ome/migration-test-failed', 502);
    }
    await this.connections.markTested(connection.id);
    return { storeName: result.storeName };
  }
}
