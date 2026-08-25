import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ProductForecastRepository } from '../domain/repositories.js';
import { dateKeyOf } from '../../analytics/domain/date-key.js';

function shiftDays(dateKey: number, days: number): Date {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

interface ForecastCandidate {
  product_id: bigint;
  total_units_14d: bigint;
  recent_7_units: bigint;
  previous_7_units: bigint;
  current_stock: bigint;
}

/** Computes ai.prisma's ProductForecast metrics — see that model's own doc
 *  comment for the exact definitions. Its own raw SQL against
 *  summary_product_daily + stock_item/product_variant/product, not routed
 *  through AnalyticsQueryRepository (unlike AiInsight's rule engine) —
 *  this needs a grain (product-only, no currency) that repository's
 *  existing per-currency-row methods don't fit cleanly. */
export class PrismaProductForecastRepository implements ProductForecastRepository {
  constructor(private readonly db: Db) {}

  async refreshForecasts(dateKey: number, websiteId: bigint): Promise<void> {
    const from14 = dateKeyOf(shiftDays(dateKey, -13));
    const from7 = dateKeyOf(shiftDays(dateKey, -6));
    const prevFrom7 = dateKeyOf(shiftDays(dateKey, -13));
    const prevTo7 = dateKeyOf(shiftDays(dateKey, -7));

    const candidates = await this.db.$queryRaw<ForecastCandidate[]>(Prisma.sql`
      WITH window_14 AS (
        SELECT product_id, SUM(units_sold) AS units
        FROM summary_product_daily
        WHERE website_id = ${websiteId} AND date_key >= ${from14} AND date_key <= ${dateKey}
        GROUP BY product_id
      ),
      recent_7 AS (
        SELECT product_id, SUM(units_sold) AS units
        FROM summary_product_daily
        WHERE website_id = ${websiteId} AND date_key >= ${from7} AND date_key <= ${dateKey}
        GROUP BY product_id
      ),
      previous_7 AS (
        SELECT product_id, SUM(units_sold) AS units
        FROM summary_product_daily
        WHERE website_id = ${websiteId} AND date_key >= ${prevFrom7} AND date_key <= ${prevTo7}
        GROUP BY product_id
      ),
      stock AS (
        SELECT pv.product_id, SUM(si.available) AS available
        FROM stock_item si
        JOIN product_variant pv ON pv.id = si.variant_id
        GROUP BY pv.product_id
      )
      SELECT
        w.product_id,
        w.units AS total_units_14d,
        COALESCE(r7.units, 0) AS recent_7_units,
        COALESCE(p7.units, 0) AS previous_7_units,
        COALESCE(s.available, 0) AS current_stock
      FROM window_14 w
      JOIN product p ON p.id = w.product_id AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
      LEFT JOIN recent_7 r7 ON r7.product_id = w.product_id
      LEFT JOIN previous_7 p7 ON p7.product_id = w.product_id
      LEFT JOIN stock s ON s.product_id = w.product_id
      WHERE w.units > 0
    `);

    const productIds = candidates.map((c) => c.product_id);
    // Delete stale rows first — a product that dropped out (sales stopped)
    // must not leave a leftover forecast behind, same "clear what's no
    // longer true" reasoning as PrismaAiInsightRepository.refreshInsights.
    await this.db.productForecast.deleteMany({
      where: { dateKey, websiteId, productId: productIds.length > 0 ? { notIn: productIds } : undefined },
    });

    for (const c of candidates) {
      const avgDailySellRate = Number(c.total_units_14d) / 14;
      const trendPct = Number(c.previous_7_units) > 0 ? ((Number(c.recent_7_units) - Number(c.previous_7_units)) / Number(c.previous_7_units)) * 100 : null;
      const currentStock = Number(c.current_stock);
      const daysOfCover = avgDailySellRate > 0 ? currentStock / avgDailySellRate : null;
      const riskTier = daysOfCover === null ? 'low' : daysOfCover < 7 ? 'high' : daysOfCover < 14 ? 'medium' : 'low';

      await this.db.productForecast.upsert({
        where: { dateKey_websiteId_productId: { dateKey, websiteId, productId: c.product_id } },
        create: {
          dateKey,
          websiteId,
          productId: c.product_id,
          avgDailySellRate,
          trendPct,
          currentStock,
          daysOfCover,
          riskTier,
        },
        update: { avgDailySellRate, trendPct, currentStock, daysOfCover, riskTier },
      });
    }
  }
}
