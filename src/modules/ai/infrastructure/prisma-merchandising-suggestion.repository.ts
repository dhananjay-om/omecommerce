import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { MerchandisingSuggestionRepository } from '../domain/repositories.js';
import { dateKeyOf } from '../../analytics/domain/date-key.js';

function shiftDays(dateKey: number, days: number): Date {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

interface SuggestionDraft {
  kind: string;
  targetType: 'PRODUCT' | 'CATEGORY';
  targetId: bigint;
  headline: string;
  rationale: string;
  impactScore: number;
  confidence: 'high' | 'medium' | 'low';
  actionLabel: string;
  actionHref: string;
}

function confidenceFromUnits(totalUnits: number): 'high' | 'medium' | 'low' {
  return totalUnits >= 20 ? 'high' : totalUnits >= 5 ? 'medium' : 'low';
}

/**
 * The merchandising-suggestion rule engine — 3 kinds, 2 of which
 * deliberately read ProductForecast's own already-computed output rather
 * than re-deriving avg-sell-rate/trend themselves (see ai.prisma's
 * MerchandisingSuggestion doc comment for the full "shares vs. duplicates"
 * reasoning). Only FEATURE_TRENDING_CATEGORY computes anything new.
 *
 * Revenue here (FEATURE_TRENDING_CATEGORY) is summed across every currency
 * a category sold in, same deliberate simplification as
 * prisma-ai-insight.repository.ts's own revenueRule (see that file's own
 * header comment) — this project's real data is single-currency per
 * website in practice.
 */
export class PrismaMerchandisingSuggestionRepository implements MerchandisingSuggestionRepository {
  constructor(private readonly db: Db) {}

  async refreshSuggestions(dateKey: number, websiteId: bigint): Promise<void> {
    const drafts = [...(await this.restockSuggestions(dateKey, websiteId)), ...(await this.promoteSlowMoverSuggestions(dateKey, websiteId)), ...(await this.featureTrendingCategorySuggestions(dateKey, websiteId))];

    // Delete stale rows not in this run's set — same "clear what's no
    // longer true" posture as AiInsight/ProductForecast. The unique key is
    // a 3-column combo Prisma's query builder can't express a composite
    // notIn over directly, so diff in JS against the existing set instead
    // of a raw-SQL tuple match.
    const existing = await this.db.merchandisingSuggestion.findMany({
      where: { dateKey, websiteId },
      select: { id: true, kind: true, targetType: true, targetId: true },
    });
    const freshKeys = new Set(drafts.map((d) => `${d.kind}:${d.targetType}:${d.targetId}`));
    const staleIds = existing.filter((e) => !freshKeys.has(`${e.kind}:${e.targetType}:${e.targetId}`)).map((e) => e.id);
    if (staleIds.length > 0) {
      await this.db.merchandisingSuggestion.deleteMany({ where: { id: { in: staleIds } } });
    }

    for (const draft of drafts) {
      await this.db.merchandisingSuggestion.upsert({
        where: { dateKey_websiteId_kind_targetType_targetId: { dateKey, websiteId, kind: draft.kind, targetType: draft.targetType, targetId: draft.targetId } },
        create: { dateKey, websiteId, ...draft },
        update: {
          headline: draft.headline,
          rationale: draft.rationale,
          impactScore: draft.impactScore,
          confidence: draft.confidence,
          actionLabel: draft.actionLabel,
          actionHref: draft.actionHref,
        },
      });
    }
  }

  /** A product forecast to run out soon (ProductForecast.riskTier
   *  high/medium) — suggests reordering enough for a 30-day buffer. */
  private async restockSuggestions(dateKey: number, websiteId: bigint): Promise<SuggestionDraft[]> {
    const rows = await this.db.productForecast.findMany({ where: { dateKey, websiteId, riskTier: { in: ['high', 'medium'] } } });
    if (rows.length === 0) return [];
    const products = await this.db.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, publicId: true, nameDefault: true } });
    const productById = new Map(products.map((p) => [p.id.toString(), p]));

    return rows.flatMap((r): SuggestionDraft[] => {
      const product = productById.get(r.productId.toString());
      if (!product) return []; // product deleted since the forecast was computed — nothing to link to
      const avgDailySellRate = Number(r.avgDailySellRate);
      const reorderQty = Math.max(1, Math.ceil(avgDailySellRate * 30) - r.currentStock);
      return [
        {
          kind: 'RESTOCK',
          targetType: 'PRODUCT',
          targetId: r.productId,
          headline: `${product.nameDefault ?? 'This product'} may run out in ${Number(r.daysOfCover ?? 0).toFixed(1)} days`,
          rationale: `Selling ~${avgDailySellRate.toFixed(2)} units/day with ${r.currentStock} on hand — reorder ~${reorderQty} units to maintain a 30-day buffer.`,
          impactScore: avgDailySellRate * 7,
          confidence: confidenceFromUnits(avgDailySellRate * 14),
          actionLabel: 'View Inventory',
          actionHref: `/products/${product.publicId}/inventory`,
        },
      ];
    });
  }

  /** The inverse problem — plenty of stock (ProductForecast.riskTier
   *  'low', so not at stockout risk) but sales clearly declining
   *  (trendPct <= -30%) — suggests a promotion to move it. */
  private async promoteSlowMoverSuggestions(dateKey: number, websiteId: bigint): Promise<SuggestionDraft[]> {
    const rows = await this.db.productForecast.findMany({ where: { dateKey, websiteId, riskTier: 'low', trendPct: { lte: -30 } } });
    if (rows.length === 0) return [];
    const products = await this.db.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, publicId: true, nameDefault: true } });
    const productById = new Map(products.map((p) => [p.id.toString(), p]));

    return rows.flatMap((r): SuggestionDraft[] => {
      const product = productById.get(r.productId.toString());
      if (!product) return [];
      const trendPct = Number(r.trendPct);
      const avgDailySellRate = Number(r.avgDailySellRate);
      return [
        {
          kind: 'PROMOTE_SLOW_MOVER',
          targetType: 'PRODUCT',
          targetId: r.productId,
          headline: `${product.nameDefault ?? 'This product'}'s sales are slowing`,
          rationale: `Down ${Math.abs(trendPct).toFixed(1)}% over the last 7 days vs. the previous 7, with ${r.currentStock} units on hand — consider a promotion to move inventory.`,
          impactScore: r.currentStock * (Math.abs(trendPct) / 100),
          confidence: confidenceFromUnits(avgDailySellRate * 14),
          actionLabel: 'View Pricing',
          actionHref: `/products/${product.publicId}/pricing`,
        },
      ];
    });
  }

  /** The one kind that computes something new — a category's revenue
   *  trending up strongly (7-vs-prior-7, same comparison pattern as AI
   *  Insights' revenue rule and ProductForecast's trend%, at category
   *  grain instead) — suggests featuring it more prominently. */
  private async featureTrendingCategorySuggestions(dateKey: number, websiteId: bigint): Promise<SuggestionDraft[]> {
    const from7 = dateKeyOf(shiftDays(dateKey, -6));
    const prevFrom7 = dateKeyOf(shiftDays(dateKey, -13));
    const prevTo7 = dateKeyOf(shiftDays(dateKey, -7));

    const rows = await this.db.$queryRaw<
      Array<{ category_id: bigint; category_public_id: string | null; category_name: string | null; recent_revenue: Prisma.Decimal; previous_revenue: Prisma.Decimal }>
    >(Prisma.sql`
      WITH recent AS (
        SELECT category_id, SUM(revenue) AS revenue
        FROM summary_category_daily
        WHERE website_id = ${websiteId} AND date_key >= ${from7} AND date_key <= ${dateKey}
        GROUP BY category_id
      ),
      previous AS (
        SELECT category_id, SUM(revenue) AS revenue
        FROM summary_category_daily
        WHERE website_id = ${websiteId} AND date_key >= ${prevFrom7} AND date_key <= ${prevTo7}
        GROUP BY category_id
      )
      SELECT r.category_id, c.public_id AS category_public_id, c.name_default AS category_name,
        r.revenue AS recent_revenue, p.revenue AS previous_revenue
      FROM recent r
      JOIN previous p ON p.category_id = r.category_id
      LEFT JOIN category c ON c.id = r.category_id
      WHERE p.revenue > 0 AND (r.revenue - p.revenue) / p.revenue >= 0.3
    `);

    return rows.flatMap((r): SuggestionDraft[] => {
      if (!r.category_public_id) return [];
      const recentRevenue = Number(r.recent_revenue);
      const previousRevenue = Number(r.previous_revenue);
      const trendPct = ((recentRevenue - previousRevenue) / previousRevenue) * 100;
      return [
        {
          kind: 'FEATURE_TRENDING_CATEGORY',
          targetType: 'CATEGORY',
          targetId: r.category_id,
          headline: `${r.category_name ?? 'This category'} is trending up ${trendPct.toFixed(1)}%`,
          rationale: `Revenue up ${trendPct.toFixed(1)}% over the last 7 days vs. the previous 7 — consider featuring it more prominently (homepage, navigation, promotions).`,
          impactScore: recentRevenue,
          confidence: recentRevenue >= 500 ? 'high' : recentRevenue >= 100 ? 'medium' : 'low',
          actionLabel: 'Edit Category',
          actionHref: `/categories/${r.category_public_id}/edit`,
        },
      ];
    });
  }
}
