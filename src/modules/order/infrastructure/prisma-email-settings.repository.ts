import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { EmailSettingsRepository, EmailSettingsRecord, UpsertEmailSettingsInput } from '../domain/repositories.js';

function toRecord(row: {
  id: bigint;
  publicId: string;
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string | null;
  fromEmail: string | null;
  updatedAt: Date;
}): EmailSettingsRecord {
  return {
    id: row.id,
    publicId: row.publicId,
    host: row.host,
    port: row.port,
    username: row.username,
    password: row.password,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    updatedAt: row.updatedAt,
  };
}

/**
 * The email_settings table is a true singleton (see its own schema doc
 * comment — enforced DB-side by a unique index on a constant expression), so
 * this repository never needs a code/id to address it: get() is a bare
 * findFirst(), upsert() finds-then-updates-or-creates rather than keying off
 * a caller-supplied id.
 */
export class PrismaEmailSettingsRepository implements EmailSettingsRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<EmailSettingsRecord | null> {
    const row = await this.db.emailSettings.findFirst();
    return row ? toRecord(row) : null;
  }

  async upsert(input: UpsertEmailSettingsInput): Promise<EmailSettingsRecord> {
    const existing = await this.db.emailSettings.findFirst();
    const data = {
      host: input.host,
      port: input.port,
      username: input.username,
      // Only overwrite the stored password when a new one was actually
      // supplied — leaving the field out of `data` on update keeps Prisma
      // from touching the column at all.
      ...(input.password !== undefined ? { password: input.password } : {}),
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      updatedBy: input.updatedBy,
    };
    const row = existing
      ? await this.db.emailSettings.update({ where: { id: existing.id }, data })
      : await this.db.emailSettings.create({
          data: { ...data, password: input.password ?? '', createdBy: input.createdBy },
        });
    return toRecord(row);
  }
}
