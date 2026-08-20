import type { EmailSettingsRepository } from '../domain/repositories.js';
import type { EmailSettingsView } from './dto.js';

/** Never returns the real password (see EmailSettings' own schema doc comment
 *  on why it's stored plaintext at all) — only whether one is set, so the
 *  admin form can show a "leave blank to keep the current password" placeholder
 *  instead of ever round-tripping the secret back to the browser. */
export class GetEmailSettings {
  constructor(private readonly settings: EmailSettingsRepository) {}

  async execute(): Promise<EmailSettingsView | null> {
    const record = await this.settings.get();
    if (!record) return null;
    return {
      host: record.host,
      port: record.port,
      username: record.username,
      hasPassword: record.password.length > 0,
      fromName: record.fromName,
      fromEmail: record.fromEmail,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
