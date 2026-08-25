import type { MerchandisingSuggestionQueryRepository, MerchandisingSuggestionListResult } from '../domain/queries.js';
import type { ListSuggestionsQuery } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;

/** Thin — mirrors list-forecasts.usecase.ts's ListForecasts exactly. */
export class ListSuggestions {
  constructor(private readonly suggestions: MerchandisingSuggestionQueryRepository) {}

  execute(q: ListSuggestionsQuery): Promise<MerchandisingSuggestionListResult> {
    return this.suggestions.list({
      kind: q.kind,
      confidence: q.confidence,
      websiteId: q.websiteId !== undefined ? BigInt(q.websiteId) : undefined,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
    });
  }
}
