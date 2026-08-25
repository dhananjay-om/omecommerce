import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { MerchandisingSuggestionQueryRepository, MerchandisingSuggestionFilter, MerchandisingSuggestionListResult } from '../domain/queries.js';

interface SuggestionRow {
  public_id: string;
  date_key: number;
  kind: string;
  target_type: string;
  target_name: string | null;
  headline: string;
  rationale: string;
  impact_score: Prisma.Decimal;
  confidence: string;
  action_label: string;
  action_href: string;
}

/** Raw SQL to resolve a display name per row — the target could be a
 *  product OR a category (targetType), so this joins whichever table
 *  applies per row rather than a single fixed join, same "no Prisma
 *  @relation for an analytics-adjacent FK" convention as the other AI
 *  query repositories. */
export class PrismaMerchandisingSuggestionQueryRepository implements MerchandisingSuggestionQueryRepository {
  constructor(private readonly db: Db) {}

  async list(filter: MerchandisingSuggestionFilter): Promise<MerchandisingSuggestionListResult> {
    const kindFilter = filter.kind ? Prisma.sql`AND ms.kind = ${filter.kind}` : Prisma.empty;
    const confidenceFilter = filter.confidence ? Prisma.sql`AND ms.confidence = ${filter.confidence}` : Prisma.empty;
    const websiteFilter = filter.websiteId !== undefined ? Prisma.sql`AND ms.website_id = ${filter.websiteId}` : Prisma.empty;
    const where = Prisma.sql`WHERE 1=1 ${kindFilter} ${confidenceFilter} ${websiteFilter}`;

    const [totalRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS n FROM merchandising_suggestion ms ${where}`),
      this.db.$queryRaw<SuggestionRow[]>(Prisma.sql`
        SELECT ms.public_id, ms.date_key, ms.kind, ms.target_type,
          COALESCE(p.name_default, c.name_default) AS target_name,
          ms.headline, ms.rationale, ms.impact_score, ms.confidence, ms.action_label, ms.action_href
        FROM merchandising_suggestion ms
        LEFT JOIN product p ON p.id = ms.target_id AND ms.target_type = 'PRODUCT'
        LEFT JOIN category c ON c.id = ms.target_id AND ms.target_type = 'CATEGORY'
        ${where}
        -- Higher impact first is the useful default — same reasoning as
        -- ProductForecast's own default sort, even though impactScore's
        -- units genuinely differ per kind (see the rule engine's own doc
        -- comment) — still a reasonable "what's most worth a look" order.
        ORDER BY ms.impact_score DESC, ms.id DESC
        LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}
      `),
    ]);

    return {
      total: Number(totalRows[0]?.n ?? 0n),
      page: filter.page,
      pageSize: filter.pageSize,
      suggestions: rows.map((r) => ({
        publicId: r.public_id,
        dateKey: r.date_key,
        kind: r.kind,
        targetType: r.target_type,
        targetName: r.target_name,
        headline: r.headline,
        rationale: r.rationale,
        impactScore: r.impact_score.toString(),
        confidence: r.confidence,
        actionLabel: r.action_label,
        actionHref: r.action_href,
      })),
    };
  }
}
