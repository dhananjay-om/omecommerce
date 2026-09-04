import type { MigrationConnectionRepository, MigrationChannel } from '../domain/repositories.js';
import type { MigrationConnectionView } from './dto.js';

/** Mirrors GetAiSettings exactly — never returns the raw token. */
export class GetMigrationConnection {
  constructor(private readonly connections: MigrationConnectionRepository) {}

  async execute(channel: MigrationChannel): Promise<MigrationConnectionView | null> {
    const record = await this.connections.getByChannel(channel);
    if (!record) return null;
    return {
      channel: record.channel,
      storeUrl: record.storeUrl,
      hasApiToken: record.apiToken.length > 0,
      isActive: record.isActive,
      lastTestedAt: record.lastTestedAt ? record.lastTestedAt.toISOString() : null,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
