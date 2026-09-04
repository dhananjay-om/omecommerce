import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  MigrationConnectionRepository,
  MigrationConnectionInfo,
  UpsertMigrationConnectionInput,
  MigrationChannel,
} from '../domain/repositories.js';

export class PrismaMigrationConnectionRepository implements MigrationConnectionRepository {
  constructor(private readonly db: Db) {}

  async getByChannel(channel: MigrationChannel): Promise<MigrationConnectionInfo | null> {
    const row = await this.db.migrationConnection.findUnique({ where: { channel } });
    return row ? toInfo(row) : null;
  }

  async getById(id: bigint): Promise<MigrationConnectionInfo | null> {
    const row = await this.db.migrationConnection.findUnique({ where: { id } });
    return row ? toInfo(row) : null;
  }

  async upsert(input: UpsertMigrationConnectionInput): Promise<MigrationConnectionInfo> {
    const data = {
      storeUrl: input.storeUrl,
      // Only overwrite the stored token when a new one was actually
      // supplied — same trick as PrismaAiSettingsRepository.upsert.
      ...(input.apiToken !== undefined ? { apiToken: input.apiToken } : {}),
      isActive: input.isActive ?? true,
      updatedBy: input.updatedBy,
    };
    const row = await this.db.migrationConnection.upsert({
      where: { channel: input.channel },
      create: { ...data, channel: input.channel, apiToken: input.apiToken ?? '', createdBy: input.createdBy },
      update: data,
    });
    return toInfo(row);
  }

  async markTested(id: bigint): Promise<void> {
    await this.db.migrationConnection.update({ where: { id }, data: { lastTestedAt: new Date() } });
  }
}

function toInfo(row: {
  id: bigint;
  publicId: string;
  channel: string;
  storeUrl: string;
  apiToken: string;
  isActive: boolean;
  lastTestedAt: Date | null;
  updatedAt: Date;
}): MigrationConnectionInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    channel: row.channel as MigrationChannel,
    storeUrl: row.storeUrl,
    apiToken: row.apiToken,
    isActive: row.isActive,
    lastTestedAt: row.lastTestedAt,
    updatedAt: row.updatedAt,
  };
}
