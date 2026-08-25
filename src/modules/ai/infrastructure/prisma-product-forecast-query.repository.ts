import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ProductForecastQueryRepository, ProductForecastFilter, ProductForecastListResult } from '../domain/queries.js';

interface ForecastRow {
  public_id: string;
  date_key: number;
  product_id: bigint;
  product_name: string | null;
  sku: string | null;
  avg_daily_sell_rate: Prisma.Decimal;
  trend_pct: Prisma.Decimal | null;
  current_stock: number;
  days_of_cover: Prisma.Decimal | null;
  risk_tier: string;
}

/** Raw SQL, not Prisma Client's `include` — same "no Prisma @relation for
 *  an analytics-adjacent FK, join in the query instead" convention as
 *  AnalyticsQueryRepository.getTopProducts (ai.prisma's ProductForecast
 *  deliberately has no `@relation` to Product, matching analytics.prisma's
 *  own header comment on why). */
export class PrismaProductForecastQueryRepository implements ProductForecastQueryRepository {
  constructor(private readonly db: Db) {}

  async list(filter: ProductForecastFilter): Promise<ProductForecastListResult> {
    const riskFilter = filter.riskTier ? Prisma.sql`AND pf.risk_tier = ${filter.riskTier}` : Prisma.empty;
    const websiteFilter = filter.websiteId !== undefined ? Prisma.sql`AND pf.website_id = ${filter.websiteId}` : Prisma.empty;
    const where = Prisma.sql`WHERE 1=1 ${riskFilter} ${websiteFilter}`;

    const [totalRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS n FROM product_forecast pf ${where}`),
      this.db.$queryRaw<ForecastRow[]>(Prisma.sql`
        SELECT pf.public_id, pf.date_key, pf.product_id, p.name_default AS product_name, p.sku,
          pf.avg_daily_sell_rate, pf.trend_pct, pf.current_stock, pf.days_of_cover, pf.risk_tier
        FROM product_forecast pf
        LEFT JOIN product p ON p.id = pf.product_id
        ${where}
        -- Highest risk first is the useful default (a product about to
        -- stock out matters more than one with weeks of cover) — NULLS
        -- LAST so zero-velocity edge cases (shouldn't exist per the
        -- refresh logic, but defensively) sort to the bottom, not the top.
        ORDER BY pf.days_of_cover ASC NULLS LAST, pf.id DESC
        LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}
      `),
    ]);

    return {
      total: Number(totalRows[0]?.n ?? 0n),
      page: filter.page,
      pageSize: filter.pageSize,
      forecasts: rows.map((r) => ({
        publicId: r.public_id,
        dateKey: r.date_key,
        productId: r.product_id.toString(),
        productName: r.product_name,
        sku: r.sku,
        avgDailySellRate: r.avg_daily_sell_rate.toString(),
        trendPct: r.trend_pct?.toString() ?? null,
        currentStock: r.current_stock,
        daysOfCover: r.days_of_cover?.toString() ?? null,
        riskTier: r.risk_tier,
      })),
    };
  }
}
