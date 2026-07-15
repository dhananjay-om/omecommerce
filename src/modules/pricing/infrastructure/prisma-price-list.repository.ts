import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  PriceListRepository,
  PriceListInfo,
  CreatePriceListInput,
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
    return { id: row.id, publicId: row.publicId, code: row.code, name: row.name, currency: row.currency, type: row.type };
  }

  async findByCode(code: string): Promise<PriceListInfo | null> {
    const row = await this.db.priceList.findFirst({ where: { code } });
    return row
      ? { id: row.id, publicId: row.publicId, code: row.code, name: row.name, currency: row.currency, type: row.type }
      : null;
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
}
