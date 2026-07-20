import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  ProductLookup,
  ProductCoreInfo,
  StoreViewLookup,
  StoreViewInfo,
  AttributeFlagsLookup,
  FacetableAttribute,
  StockAvailabilityLookup,
  CategoryMembershipLookup,
} from '../domain/repositories.js';

export class PrismaProductLookup implements ProductLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<ProductCoreInfo | null> {
    return this.db.product.findFirst({
      where: { publicId },
      select: { id: true, publicId: true, sku: true, nameDefault: true, type: true, status: true, visibility: true, attributeSetId: true },
    }).then((r) => (r ? toCore(r) : null));
  }

  async allActive(): Promise<ProductCoreInfo[]> {
    const rows = await this.db.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, publicId: true, sku: true, nameDefault: true, type: true, status: true, visibility: true, attributeSetId: true },
    });
    return rows.map(toCore);
  }

  async firstVariantId(productId: bigint): Promise<bigint | null> {
    const variant = await this.db.productVariant.findFirst({
      where: { productId },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    return variant?.id ?? null;
  }
}

function toCore(row: {
  id: bigint;
  publicId: string;
  sku: string;
  nameDefault: string | null;
  type: string;
  status: string;
  visibility: string;
  attributeSetId: bigint;
}): ProductCoreInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    sku: row.sku,
    name: row.nameDefault,
    type: row.type,
    status: row.status,
    visibility: row.visibility,
    attributeSetId: row.attributeSetId,
  };
}

export class PrismaStoreViewLookup implements StoreViewLookup {
  constructor(private readonly db: Db) {}

  async allActive(): Promise<StoreViewInfo[]> {
    const rows = await this.db.storeView.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, currency: true, storeId: true, store: { select: { websiteId: true } } },
    });
    return rows.map((r) => ({ id: r.id, currency: r.currency, storeId: r.storeId, websiteId: r.store.websiteId }));
  }
}

export class PrismaAttributeFlagsLookup implements AttributeFlagsLookup {
  constructor(private readonly db: Db) {}

  async facetable(): Promise<FacetableAttribute[]> {
    return this.db.attribute.findMany({
      where: { OR: [{ isFilterable: true }, { usedInLayeredNav: true }] },
      select: { id: true, code: true },
    });
  }
}

/** Read-only display flag — no ledger/guarded-UPDATE machinery needed (plan/07 §2 is
 * for money-moving writes; this only reads a projection). */
export class PrismaStockAvailabilityLookup implements StockAvailabilityLookup {
  constructor(private readonly db: Db) {}

  async isInStock(productId: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ in_stock: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM stock_item si
        JOIN product_variant pv ON pv.id = si.variant_id
        WHERE pv.product_id = ${productId} AND si.available > 0
      ) AS in_stock`;
    return rows[0]?.in_stock ?? false;
  }
}

export class PrismaCategoryMembershipLookup implements CategoryMembershipLookup {
  constructor(private readonly db: Db) {}

  async categoryPublicIds(productId: bigint): Promise<string[]> {
    const rows = await this.db.productCategory.findMany({
      where: { productId },
      select: { category: { select: { publicId: true } } },
    });
    return rows.map((r) => r.category.publicId);
  }
}
