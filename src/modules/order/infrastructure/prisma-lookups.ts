import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { VariantLookup, WarehouseResolver, CustomerGroupLookup, CartProductMediaLookup } from '../domain/repositories.js';

export class PrismaVariantLookup implements VariantLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint; sku: string; nameDefault: string | null; productId: bigint } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { publicId },
      select: { id: true, sku: true, productId: true, product: { select: { nameDefault: true } } },
    });
    return row ? { id: row.id, sku: row.sku, nameDefault: row.product.nameDefault, productId: row.productId } : null;
  }

  async byId(id: bigint): Promise<{ sku: string; nameDefault: string | null; productId: bigint } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { id },
      select: { sku: true, productId: true, product: { select: { nameDefault: true } } },
    });
    return row ? { sku: row.sku, nameDefault: row.product.nameDefault, productId: row.productId } : null;
  }
}

/** Own copy of search's identical PrismaProductMediaLookup (per-module lookup convention). */
export class PrismaCartProductMediaLookup implements CartProductMediaLookup {
  constructor(private readonly db: Db) {}

  async primaryImageKey(productId: bigint): Promise<string | null> {
    const rows = await this.db.$queryRaw<Array<{ storage_key: string }>>`
      SELECT ma.storage_key
      FROM product_media pm
      JOIN media_asset ma ON ma.id = pm.asset_id
      WHERE pm.product_id = ${productId}
      ORDER BY pm.position ASC
      LIMIT 1`;
    return rows[0]?.storage_key ?? null;
  }
}

export class PrismaCustomerGroupLookup implements CustomerGroupLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.customerGroup.findFirst({ where: { code }, select: { id: true } });
  }
}

/**
 * Picks a fulfillment warehouse (plan/07 §4 sourcing). Prefers the store's
 * configured store_warehouse mapping (lowest priority number = primary); falls
 * back to the first active warehouse so checkout works before any admin has
 * configured store-warehouse mappings yet.
 */
export class PrismaWarehouseResolver implements WarehouseResolver {
  constructor(private readonly db: Db) {}

  async resolveForStore(storeId: bigint): Promise<{ id: bigint; code: string } | null> {
    const mapped = await this.db.storeWarehouse.findFirst({
      where: { storeId },
      orderBy: { priority: 'asc' },
      select: { warehouse: { select: { id: true, code: true } } },
    });
    if (mapped) return mapped.warehouse;

    const fallback = await this.db.warehouse.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { id: 'asc' },
      select: { id: true, code: true },
    });
    return fallback ?? null;
  }

  async resolveForOrderLine(orderLineId: bigint): Promise<{ id: bigint; code: string } | null> {
    // Fulfillment.warehouseId is a plain scalar (FK added via raw SQL, per the
    // scope-FK convention) — no Prisma relation path exists, so this is two
    // queries rather than one nested select.
    const line = await this.db.fulfillmentLine.findFirst({
      where: { orderLineId },
      orderBy: { fulfillmentId: 'desc' },
      select: { fulfillment: { select: { warehouseId: true } } },
    });
    if (!line) return null;
    return this.db.warehouse.findFirst({
      where: { id: line.fulfillment.warehouseId },
      select: { id: true, code: true },
    });
  }
}
