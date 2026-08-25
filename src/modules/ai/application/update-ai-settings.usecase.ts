import type { AiSettingsRepository } from '../domain/repositories.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import type { UpdateAiSettingsCommand, AiSettingsView } from './dto.js';
import { GetAiSettings } from './get-ai-settings.usecase.js';

/** Mirrors order/application/update-email-settings.usecase.ts's
 *  UpdateEmailSettings exactly — apiKey is required only on the very first
 *  save; every subsequent save can omit it to leave the stored key
 *  unchanged. No admin-actor resolution (unlike EmailSettings' createdBy/
 *  updatedBy) — that would need AdminUserLookup from the order module
 *  reached across a module boundary for an audit nicety that isn't worth
 *  that coupling; createdBy/updatedBy are just left null here. */
export class UpdateAiSettings {
  constructor(private readonly settings: AiSettingsRepository) {}

  async execute(cmd: UpdateAiSettingsCommand): Promise<AiSettingsView> {
    const existing = await this.settings.get();
    if (!existing && !cmd.apiKey) {
      throw new ValidationError('apiKey is required the first time AI settings are saved', [{ path: 'apiKey', message: 'required' }]);
    }

    await this.settings.upsert({
      provider: cmd.provider,
      apiKey: cmd.apiKey,
      model: cmd.model,
      isActive: cmd.isActive,
      createdBy: null,
      updatedBy: null,
    });

    return (await new GetAiSettings(this.settings).execute())!;
  }
}
