import type { MerchandisingSuggestionRepository } from '../domain/repositories.js';

export interface RefreshWebsiteSuggestionsCommand {
  dateKey: number;
  websiteId: bigint;
}

/** Mirrors refresh-website-forecasts.usecase.ts's RefreshWebsiteForecasts
 *  exactly — the single code path for regenerating one (dateKey,
 *  websiteId) bucket's suggestions. */
export class RefreshWebsiteSuggestions {
  constructor(private readonly suggestions: MerchandisingSuggestionRepository) {}

  async execute(cmd: RefreshWebsiteSuggestionsCommand): Promise<void> {
    await this.suggestions.refreshSuggestions(cmd.dateKey, cmd.websiteId);
  }
}
