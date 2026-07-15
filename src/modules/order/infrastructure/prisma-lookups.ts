import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { VariantLookup, WarehouseResolver, CustomerGroupLookup } from '../domain/repositories.js';

export class PrismaVariantLookup implements VariantLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint; sku: string; nameDefault: string | null } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { publicId },
      select: { id: true, sku: true, product: { select: { nameDefault: true } } },
    });
    return row ? { id: row.id, sku: row.sku, nameDefault: row.product.nameDefault } : null;
  }

  async byId(id: bigint): Promise<{ sku: string; nameDefault: string | null } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { id },
      select: { sku: true, product: { select: { nameDefault: true } } },
    });
    return row ? { sku: row.sku, nameDefault: row.product.nameDefault } : null;
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
