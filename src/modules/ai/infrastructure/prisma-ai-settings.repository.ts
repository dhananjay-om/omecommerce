import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AiSettingsRepository, AiSettingsRecord, UpsertAiSettingsInput } from '../domain/repositories.js';

export class PrismaAiSettingsRepository implements AiSettingsRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<AiSettingsRecord | null> {
    const row = await this.db.aiSettings.findFirst();
    return row ? toRecord(row) : null;
  }

  async upsert(input: UpsertAiSettingsInput): Promise<AiSettingsRecord> {
    const existing = await this.db.aiSettings.findFirst();
    const data = {
      provider: input.provider,
      // Only overwrite the stored key when a new one was actually supplied
      // — leaving it out of `data` on update keeps Prisma from touching the
      // column at all, same trick as PrismaEmailSettingsRepository.upsert.
      ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
      model: input.model,
      isActive: input.isActive,
      updatedBy: input.updatedBy,
    };
    const row = existing
      ? await this.db.aiSettings.update({ where: { id: existing.id }, data })
      : await this.db.aiSettings.create({ data: { ...data, apiKey: input.apiKey ?? '', createdBy: input.createdBy } });
    return toRecord(row);
  }
}

function toRecord(row: { id: bigint; publicId: string; provider: string; apiKey: string; model: string; isActive: boolean; updatedAt: Date }): AiSettingsRecord {
  return { id: row.id, publicId: row.publicId, provider: row.provider, apiKey: row.apiKey, model: row.model, isActive: row.isActive, updatedAt: row.updatedAt };
}
