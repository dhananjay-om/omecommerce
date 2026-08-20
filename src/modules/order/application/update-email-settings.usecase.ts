import type { EmailSettingsRepository, AdminUserLookup } from '../domain/repositories.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { UpdateEmailSettingsCommand, EmailSettingsView } from './dto.js';

/**
 * Upserts the one singleton email_settings row. A password is REQUIRED the
 * very first time this is ever saved (there's nothing to "keep unchanged" yet
 * — an empty password would violate the DB's own non-blank CHECK); every
 * save after that may omit it to leave the currently-stored one untouched,
 * matching GetEmailSettings' "never show it back" contract.
 */
export class UpdateEmailSettings {
  constructor(
    private readonly settings: EmailSettingsRepository,
    private readonly adminUsers: AdminUserLookup,
  ) {}

  async execute(cmd: UpdateEmailSettingsCommand): Promise<EmailSettingsView> {
    const existing = await this.settings.get();
    if (!existing && !cmd.password) {
      throw new ValidationError('password is required the first time SMTP settings are saved', [
        { path: 'password', message: 'required' },
      ]);
    }

    const actor = cmd.updatedBy ? await this.adminUsers.findByPublicId(cmd.updatedBy) : null;

    const record = await this.settings.upsert({
      host: cmd.host,
      port: cmd.port,
      username: cmd.username,
      password: cmd.password,
      fromName: cmd.fromName ?? null,
      fromEmail: cmd.fromEmail ?? null,
      createdBy: actor?.id ?? null,
      updatedBy: actor?.id ?? null,
    });

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
