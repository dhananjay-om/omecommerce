import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  PriceListRepository,
  PriceListInfo,
  CreatePriceListInput,
  VariantPriceRow,
} from '../domain/repositories.js';

export class PrismaPriceListRepository implements PriceListRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreatePriceListInput): Promise<PriceListInfo> {
    const row = await this.db.priceList.create({
      data: {
        code: input.code,
        name: input.name,
        currency: input.currency,
        type: input.type,
        priority: input.priority,
        customerGroupId: input.customerGroupId ?? null,
        websiteId: input.websiteId ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });
    return {
      id: row.id,
      publicId: row.publicId,
      code: row.code,
      name: row.name,
      currency: row.currency,
      type: row.type,
      priority: row.priority,
    };
  }

  async findByCode(code: string): Promise<PriceListInfo | null> {
    const row = await this.db.priceList.findFirst({ where: { code } });
    return row
      ? {
          id: row.id,
          publicId: row.publicId,
          code: row.code,
          name: row.name,
          currency: row.currency,
          type: row.type,
          priority: row.priority,
        }
      : null;
  }

  async list(): Promise<PriceListInfo[]> {
    const rows = await this.db.priceList.findMany({
      where: { deletedAt: null },
      orderBy: { priority: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      code: row.code,
      name: row.name,
      currency: row.currency,
      type: row.type,
      priority: row.priority,
    }));
  }

  async setProductPrice(priceListId: bigint, variantId: bigint, price: string): Promise<void> {
    await this.db.productPrice.upsert({
      where: { priceListId_variantId: { priceListId, variantId } },
      update: { price },
      create: { priceListId, variantId, price },
    });
  }

  async setPriceTier(priceListId: bigint, variantId: bigint, minQty: number, price: string): Promise<void> {
    await this.db.priceTier.upsert({
      where: { priceListId_variantId_minQty: { priceListId, variantId, minQty } },
      update: { price },
      create: { priceListId, variantId, minQty, price },
    });
  }

  async listPricesForVariant(variantId: bigint): Promise<VariantPriceRow[]> {
    // LEFT JOIN from price_list (not product_price) so a list this variant
    // has no price in yet still shows up, with price: null — "not priced
    // here" is a visible state, not an absent row.
    const rows = await this.db.$queryRaw<
      Array<{ price_list_code: string; price_list_name: string; currency: string; price: string | null }>
    >`
      SELECT pl.code AS price_list_code, pl.name AS price_list_name, pl.currency,
             pp.price::text AS price
        FROM price_list pl
        LEFT JOIN product_price pp ON pp.price_list_id = pl.id AND pp.variant_id = ${variantId}
       WHERE pl.deleted_at IS NULL
       ORDER BY pl.priority DESC`;
    return rows.map((row) => ({
      priceListCode: row.price_list_code,
      priceListName: row.price_list_name,
      currency: row.currency,
      price: row.price,
    }));
  }
}
