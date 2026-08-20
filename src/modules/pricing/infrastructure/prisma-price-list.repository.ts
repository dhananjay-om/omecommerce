import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  PriceListRepository,
  PriceListInfo,
  CreatePriceListInput,
  UpdatePriceListInput,
  VariantPriceRow,
} from '../domain/repositories.js';

function toInfo(row: {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  currency: string;
  type: PriceListInfo['type'];
  priority: number;
  isActive: boolean;
}): PriceListInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    code: row.code,
    name: row.name,
    currency: row.currency,
    type: row.type,
    priority: row.priority,
    isActive: row.isActive,
  };
}

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
    return toInfo(row);
  }

  async findByCode(code: string): Promise<PriceListInfo | null> {
    const row = await this.db.priceList.findFirst({ where: { code } });
    return row ? toInfo(row) : null;
  }

  async list(): Promise<PriceListInfo[]> {
    const rows = await this.db.priceList.findMany({
      where: { deletedAt: null },
      orderBy: { priority: 'desc' },
    });
    return rows.map(toInfo);
  }

  async update(id: bigint, input: UpdatePriceListInput): Promise<PriceListInfo> {
    const row = await this.db.priceList.update({
      where: { id },
      data: {
        name: input.name,
        currency: input.currency,
        type: input.type,
        priority: input.priority,
        isActive: input.isActive,
      },
    });
    return toInfo(row);
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.priceList.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async setProductPrice(priceListId: bigint, variantId: bigint, price: string, mrp: string | null): Promise<void> {
    await this.db.productPrice.upsert({
      where: { priceListId_variantId: { priceListId, variantId } },
      update: { price, mrp },
      create: { priceListId, variantId, price, mrp },
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
      Array<{
        price_list_code: string;
        price_list_name: string;
        currency: string;
        price: string | null;
        mrp: string | null;
      }>
    >`
      SELECT pl.code AS price_list_code, pl.name AS price_list_name, pl.currency,
             pp.price::text AS price, pp.mrp::text AS mrp
        FROM price_list pl
        LEFT JOIN product_price pp ON pp.price_list_id = pl.id AND pp.variant_id = ${variantId}
       WHERE pl.deleted_at IS NULL AND pl.is_active = true
       ORDER BY pl.priority DESC`;
    return rows.map((row) => ({
      priceListCode: row.price_list_code,
      priceListName: row.price_list_name,
      currency: row.currency,
      price: row.price,
      mrp: row.mrp,
    }));
  }
}
