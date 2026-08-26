import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { DomainError } from '../../../shared/domain/errors.js';
import { getObjectBytes } from '../../../shared/infrastructure/storage/s3-client.js';
import { getOpenAiClient } from '../infrastructure/dynamic-openai-client.js';
import * as assistant from '../infrastructure/product-assistant-openai.js';
import type { ProductContext, ImageAnalysisDraft, PriceSuggestion, CategorySuggestion } from '../infrastructure/product-assistant-openai.js';
import { todayDateKey } from '../../analytics/domain/date-key.js';

function shiftDays(dateKey: number, days: number): Date {
  const s = String(dateKey);
  const d = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateKeyOf(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/**
 * Backs the product edit page's "AI Product Assistant" card
 * (src/modules/ai/infrastructure/product-assistant-openai.ts's own header
 * comment has the full "draft, don't silently apply" philosophy). This
 * class is just the thin orchestration layer: resolve an OpenAI client
 * (same no-key-configured DomainError as ChatWithAssistant), gather any
 * real grounding data a given action needs, hand off to the pure OpenAI-
 * calling functions. Nothing here persists anything — every route this
 * backs is read-only from the database's point of view (analyzeImage reads
 * an already-uploaded temp image, it doesn't write one).
 */
export class ProductAssistant {
  constructor(private readonly db: Db) {}

  private async requireHandle() {
    const handle = await getOpenAiClient(this.db);
    if (!handle) {
      throw new DomainError('The AI Product Assistant needs an OpenAI key — configure one in AI Settings.', 'https://errors.ome/ai-not-configured', 404);
    }
    return handle;
  }

  async generateTitle(ctx: ProductContext): Promise<string> {
    return assistant.generateTitle(await this.requireHandle(), ctx);
  }

  async generateTags(ctx: ProductContext): Promise<string[]> {
    return assistant.generateTags(await this.requireHandle(), ctx);
  }

  async generateSeoTitle(ctx: ProductContext): Promise<string> {
    return assistant.generateSeoTitle(await this.requireHandle(), ctx);
  }

  async generateMetaDescription(ctx: ProductContext): Promise<string> {
    return assistant.generateMetaDescription(await this.requireHandle(), ctx);
  }

  /** `storageKey` is a temp upload from the same presigned-PUT flow the
   *  Media tab uses (media.module's `POST /admin/v1/media/uploads`) — read
   *  directly via getObjectBytes (same "server needs the actual bytes, not
   *  just a URL to hand to a browser" case as invoice-branding.ts's logo
   *  embedding) and base64-embedded into the vision request, rather than
   *  handed to OpenAI as a URL — robust regardless of whether the storage
   *  endpoint is reachable from the public internet (it usually isn't in a
   *  self-hosted deployment). This image is never registered as a
   *  MediaAsset/attached to the product gallery — it's a one-shot analysis
   *  input, not a listing photo (the admin can upload it for real via the
   *  Media tab afterward if they like the result). */
  async analyzeImage(ctx: ProductContext, storageKey: string, mimeType: string): Promise<ImageAnalysisDraft> {
    const handle = await this.requireHandle();
    const bytes = await getObjectBytes(storageKey);
    const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`;
    return assistant.analyzeProductImage(handle, ctx, dataUrl);
  }

  async analyzePerformance(productId: bigint, ctx: ProductContext): Promise<string> {
    const handle = await this.requireHandle();
    const summary = await this.buildPerformanceSummary(productId);
    return assistant.analyzePerformance(handle, ctx, summary);
  }

  async suggestPrice(productId: bigint, ctx: ProductContext): Promise<PriceSuggestion> {
    const handle = await this.requireHandle();
    const priceContext = await this.buildPriceContext(productId);
    return assistant.suggestPrice(handle, ctx, priceContext);
  }

  async suggestCategory(ctx: ProductContext, availableCategoryNames: string[]): Promise<CategorySuggestion> {
    return assistant.suggestCategory(await this.requireHandle(), ctx, availableCategoryNames);
  }

  /** Trailing-30-day vs. prior-30-day units/revenue/orders from
   *  summary_product_daily (same table Forecasting/Insights already read),
   *  plus the latest ProductForecast row if one exists (a bonus signal, not
   *  required — a brand-new product may not have one yet). A 30-day window
   *  reads more naturally for "how's this product doing" than the 7-day
   *  windows Insights/Forecasting use for trend detection. */
  private async buildPerformanceSummary(productId: bigint): Promise<string> {
    const today = todayDateKey(new Date());
    // "previous" bucket = [prevFrom30, from30 - 1] — the CASE below splits
    // the WHERE-bounded range at from30, so there's no separate upper bound
    // to name for the previous window; it falls out of the split itself.
    const from30 = dateKeyOf(shiftDays(today, -29));
    const prevFrom30 = dateKeyOf(shiftDays(today, -59));

    const [rows, forecastRow] = await Promise.all([
      this.db.$queryRaw<Array<{ bucket: string; units: bigint | null; revenue: Prisma.Decimal | null; orders: bigint | null }>>(Prisma.sql`
        SELECT
          CASE WHEN date_key >= ${from30} THEN 'current' ELSE 'previous' END AS bucket,
          SUM(units_sold) AS units, SUM(revenue) AS revenue, SUM(order_count) AS orders
        FROM summary_product_daily
        WHERE product_id = ${productId} AND date_key >= ${prevFrom30} AND date_key <= ${today}
        GROUP BY 1
      `),
      this.db.productForecast.findFirst({ where: { productId }, orderBy: { dateKey: 'desc' } }),
    ]);

    const current = rows.find((r) => r.bucket === 'current');
    const previous = rows.find((r) => r.bucket === 'previous');
    const lines = [
      `Last 30 days: ${Number(current?.units ?? 0)} units sold, ${Number(current?.revenue ?? 0).toFixed(2)} revenue, ${Number(current?.orders ?? 0)} orders.`,
      `Prior 30 days: ${Number(previous?.units ?? 0)} units sold, ${Number(previous?.revenue ?? 0).toFixed(2)} revenue, ${Number(previous?.orders ?? 0)} orders.`,
    ];
    if (forecastRow) {
      lines.push(
        `Latest forecast (as of ${forecastRow.dateKey}): avg. ${forecastRow.avgDailySellRate.toFixed(2)} units/day, ` +
          `${forecastRow.currentStock} units in stock, risk tier "${forecastRow.riskTier}"` +
          (forecastRow.daysOfCover !== null ? `, ${forecastRow.daysOfCover.toFixed(1)} days of cover.` : '.'),
      );
    } else {
      lines.push('No forecast data available yet for this product.');
    }
    return lines.join('\n');
  }

  /** Current base price, this product's category-average base price (a
   *  simple, honestly-labeled comparison point — not a real competitor/
   *  market-price feed, which this system has no access to), and the
   *  latest forecast row if any (sell velocity is directly relevant to a
   *  pricing decision). Prices are per-variant/per-price-list (see
   *  pricing.prisma's own header comment) — this uses the product's first
   *  variant's BASE price list entry as the representative "current price,"
   *  same simplification StoreProductDetailView.price already documents. */
  private async buildPriceContext(productId: bigint): Promise<string> {
    const [currentPriceRows, categoryAvgRows, forecastRow] = await Promise.all([
      this.db.$queryRaw<Array<{ price: Prisma.Decimal; mrp: Prisma.Decimal | null; currency: string }>>(Prisma.sql`
        SELECT pp.price, pp.mrp, pl.currency
        FROM product_price pp
        JOIN price_list pl ON pl.id = pp.price_list_id
        JOIN product_variant pv ON pv.id = pp.variant_id
        WHERE pv.product_id = ${productId} AND pl.type = 'BASE' AND pl.is_active = true AND pl.deleted_at IS NULL
        ORDER BY pl.priority DESC, pp.id ASC
        LIMIT 1
      `),
      this.db.$queryRaw<Array<{ avg_price: Prisma.Decimal | null; sample_size: bigint }>>(Prisma.sql`
        WITH my_categories AS (SELECT category_id FROM product_category WHERE product_id = ${productId})
        SELECT AVG(pp.price) AS avg_price, COUNT(DISTINCT p2.id) AS sample_size
        FROM product_category pc2
        JOIN product p2 ON p2.id = pc2.product_id AND p2.deleted_at IS NULL AND p2.id != ${productId}
        JOIN product_variant pv2 ON pv2.product_id = p2.id
        JOIN product_price pp ON pp.variant_id = pv2.id
        JOIN price_list pl ON pl.id = pp.price_list_id AND pl.type = 'BASE' AND pl.is_active = true AND pl.deleted_at IS NULL
        WHERE pc2.category_id IN (SELECT category_id FROM my_categories)
      `),
      this.db.productForecast.findFirst({ where: { productId }, orderBy: { dateKey: 'desc' } }),
    ]);

    const lines: string[] = [];
    const current = currentPriceRows[0];
    lines.push(
      current
        ? `Current base price: ${current.price.toFixed(2)} ${current.currency}${current.mrp ? ` (MRP ${current.mrp.toFixed(2)})` : ''}.`
        : 'No base price configured for this product yet.',
    );
    const catAvg = categoryAvgRows[0];
    lines.push(
      catAvg?.avg_price && Number(catAvg.sample_size) > 0
        ? `Average base price of ${catAvg.sample_size} other products in the same categories: ${Number(catAvg.avg_price).toFixed(2)}.`
        : 'No other priced products in the same categories to compare against.',
    );
    if (forecastRow) {
      lines.push(
        `Sales velocity: avg. ${forecastRow.avgDailySellRate.toFixed(2)} units/day` +
          (forecastRow.trendPct !== null ? `, trending ${forecastRow.trendPct.toFixed(1)}% vs. the prior week` : '') +
          `, stockout risk "${forecastRow.riskTier}".`,
      );
    }
    return lines.join('\n');
  }
}
