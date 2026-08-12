import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { PriceResolver, ResolvePriceInput, ResolvedPrice } from '../domain/repositories.js';

interface ResolvedRow {
  price_list_id: bigint;
  price_list_code: string;
  price: string;
  source: 'tier' | 'base';
}

/**
 * Resolves the winning price for a variant (plan/01 §7): iterate active,
 * scope-matching, in-window price lists in priority order, and for EACH one check
 * whether it actually prices this variant — via a qualifying tier row first, else
 * its base row — before accepting it. A plain single-table join would silently
 * skip a tier-only price list with no base row (schema-review finding, see
 * prisma/schema/pricing.prisma header comment). The COALESCE + outer NULL filter
 * below is exactly that per-candidate EXISTS check, done in one query.
 */
export class PrismaPriceResolver implements PriceResolver {
  constructor(private readonly db: Db) {}

  async resolve(input: ResolvePriceInput): Promise<ResolvedPrice | null> {
    const rows = await this.db.$queryRaw<ResolvedRow[]>`
      SELECT price_list_id, price_list_code, price, source FROM (
        SELECT
          pl.id AS price_list_id,
          pl.code AS price_list_code,
          pl.priority,
          COALESCE(
            (SELECT pt.price FROM price_tier pt
              WHERE pt.price_list_id = pl.id AND pt.variant_id = ${input.variantId} AND pt.min_qty <= ${input.qty}
              ORDER BY pt.min_qty DESC LIMIT 1),
            (SELECT pp.price FROM product_price pp
              WHERE pp.price_list_id = pl.id AND pp.variant_id = ${input.variantId})
          )::text AS price,
          CASE WHEN EXISTS (
            SELECT 1 FROM price_tier pt
             WHERE pt.price_list_id = pl.id AND pt.variant_id = ${input.variantId} AND pt.min_qty <= ${input.qty}
          ) THEN 'tier' ELSE 'base' END AS source
        FROM price_list pl
        WHERE pl.is_active
          AND pl.deleted_at IS NULL
          AND pl.currency = ${input.currency}
          AND (pl.customer_group_id = ${input.customerGroupId} OR pl.customer_group_id IS NULL)
          AND (pl.website_id = ${input.websiteId} OR pl.website_id IS NULL)
          AND (pl.starts_at IS NULL OR pl.starts_at <= ${input.asOf})
          AND (pl.ends_at IS NULL OR pl.ends_at >= ${input.asOf})
        ORDER BY pl.priority DESC
      ) candidates
      WHERE price IS NOT NULL
      LIMIT 1`;

    const row = rows[0];
    if (!row) return null;
    return {
      price: row.price,
      priceListId: row.price_list_id,
      priceListCode: row.price_list_code,
      source: row.source,
    };
  }
}
