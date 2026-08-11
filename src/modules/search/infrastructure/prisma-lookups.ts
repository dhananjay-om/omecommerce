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
  BrandLookup,
  ProductMediaLookup,
} from '../domain/repositories.js';

export class PrismaProductLookup implements ProductLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<ProductCoreInfo | null> {
    return this.db.product.findFirst({
      where: { publicId, deletedAt: null },
      select: { id: true, publicId: true, sku: true, nameDefault: true, type: true, status: true, visibility: true, attributeSetId: true },
    }).then((r) => (r ? toCore(r) : null));
  }

  async allActive(): Promise<ProductCoreInfo[]> {
    const rows = await this.db.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
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

  /**
   * Directly-assigned categories PLUS every one of their ancestors, via
   * `category_closure` — so filtering a PLP by a root category (e.g.
   * "Electronics") also surfaces products only assigned to a descendant
   * (e.g. "Laptops"), the way category browsing is expected to behave.
   * `category_closure` includes a depth-0 self row per category, so a
   * directly-assigned leaf category is covered by the same JOIN.
   */
  async categoryPublicIds(productId: bigint): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ public_id: string }>>`
      SELECT DISTINCT c.public_id
      FROM product_category pc
      JOIN category_closure cc ON cc.descendant_id = pc.category_id
      JOIN category c ON c.id = cc.ancestor_id
      WHERE pc.product_id = ${productId}`;
    return rows.map((r) => r.public_id);
  }
}

export class PrismaBrandLookup implements BrandLookup {
  constructor(private readonly db: Db) {}

  async brandPublicId(productId: bigint): Promise<string | null> {
    const row = await this.db.product.findFirst({ where: { id: productId }, select: { brand: { select: { publicId: true } } } });
    return row?.brand?.publicId ?? null;
  }
}

export class PrismaProductMediaLookup implements ProductMediaLookup {
  constructor(private readonly db: Db) {}

  /** Feeds the search index's PLP/search-hit thumbnail — must match every other "single image" lookup's role filter + THUMBNAIL-first ordering (own copy of catalog module's identical query, per-module lookup convention). */
  async primaryImageKey(productId: bigint): Promise<string | null> {
    const rows = await this.db.$queryRaw<Array<{ storage_key: string }>>`
      SELECT ma.storage_key
      FROM product_media pm
      JOIN media_asset ma ON ma.id = pm.asset_id
      WHERE pm.product_id = ${productId}
        AND pm.role IN ('GALLERY', 'THUMBNAIL')
      ORDER BY (pm.role = 'THUMBNAIL') DESC, pm.position ASC
      LIMIT 1`;
    return rows[0]?.storage_key ?? null;
  }
}
