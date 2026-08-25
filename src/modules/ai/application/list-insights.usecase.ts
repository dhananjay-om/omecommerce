import type { AiInsightQueryRepository, AiInsightListResult } from '../domain/queries.js';
import { parseDateKey } from '../../analytics/domain/date-key.js';
import type { ListInsightsQuery } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;

/** Thin — range/pagination-parse and delegate, matching
 *  analytics/application/query-analytics.usecases.ts's own "no business
 *  logic left to own here" reasoning: the rule engine already produced
 *  everything this needs to do is read it back. */
export class ListInsights {
  constructor(private readonly insights: AiInsightQueryRepository) {}

  execute(q: ListInsightsQuery): Promise<AiInsightListResult> {
    return this.insights.list({
      category: q.category,
      impact: q.impact,
      fromDateKey: q.dateFrom ? parseDateKey(q.dateFrom) : undefined,
      toDateKey: q.dateTo ? parseDateKey(q.dateTo) : undefined,
      websiteId: q.websiteId !== undefined ? BigInt(q.websiteId) : undefined,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
    });
  }
}
