import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AiInsightQueryRepository, AiInsightFilter, AiInsightListResult } from '../domain/queries.js';

export class PrismaAiInsightQueryRepository implements AiInsightQueryRepository {
  constructor(private readonly db: Db) {}

  async list(filter: AiInsightFilter): Promise<AiInsightListResult> {
    const where = {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.impact ? { impact: filter.impact } : {}),
      ...(filter.websiteId !== undefined ? { websiteId: filter.websiteId } : {}),
      ...(filter.fromDateKey !== undefined || filter.toDateKey !== undefined
        ? { dateKey: { ...(filter.fromDateKey !== undefined ? { gte: filter.fromDateKey } : {}), ...(filter.toDateKey !== undefined ? { lte: filter.toDateKey } : {}) } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.aiInsight.count({ where }),
      this.db.aiInsight.findMany({
        where,
        // Not sorted by impact — 'high'/'medium'/'low' sorts wrong
        // alphabetically (high, low, medium) and a real severity order needs
        // a CASE expression Prisma's plain orderBy can't express; the
        // frontend's impact badge makes severity visually obvious regardless
        // of list order.
        orderBy: [{ dateKey: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      insights: rows.map((r) => ({
        publicId: r.publicId,
        dateKey: r.dateKey,
        category: r.category,
        impact: r.impact,
        headline: r.headline,
        actionLabel: r.actionLabel,
        actionHref: r.actionHref,
        createdAt: r.createdAt,
      })),
    };
  }
}
