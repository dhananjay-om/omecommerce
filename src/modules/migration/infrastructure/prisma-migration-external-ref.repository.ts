import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { MigrationExternalRefRepository } from '../domain/repositories.js';

export class PrismaMigrationExternalRefRepository implements MigrationExternalRefRepository {
  constructor(private readonly db: Db) {}

  async find(connectionId: bigint, externalType: string, externalId: string): Promise<string | null> {
    const row = await this.db.migrationExternalRef.findUnique({
      where: { connectionId_externalType_externalId: { connectionId, externalType, externalId } },
      select: { localPublicId: true },
    });
    return row?.localPublicId ?? null;
  }

  async record(runId: bigint, connectionId: bigint, externalType: string, externalId: string, localPublicId: string): Promise<void> {
    // createMany + skipDuplicates: recording a ref that already exists
    // (e.g. re-running a migration) is a harmless no-op — see this
    // repository port's own doc comment on why that's what makes
    // re-running a migration safe.
    await this.db.migrationExternalRef.createMany({
      data: [{ runId, connectionId, externalType, externalId, localPublicId }],
      skipDuplicates: true,
    });
  }
}
