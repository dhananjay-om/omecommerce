import type { AiSettingsRepository } from '../domain/repositories.js';
import type { AiSettingsView } from './dto.js';

/** Mirrors order/application/get-email-settings.usecase.ts's GetEmailSettings
 *  exactly — never returns the raw key, only whether one is set. */
export class GetAiSettings {
  constructor(private readonly settings: AiSettingsRepository) {}

  async execute(): Promise<AiSettingsView | null> {
    const record = await this.settings.get();
    if (!record) return null;
    return {
      provider: record.provider,
      model: record.model,
      hasApiKey: record.apiKey.length > 0,
      isActive: record.isActive,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
