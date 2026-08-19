import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  VariantLookup,
  WarehouseResolver,
  CustomerGroupLookup,
  CartProductMediaLookup,
  AdminUserLookup,
  CompanyMembershipLookup,
  CompanyLookup,
} from '../domain/repositories.js';

export class PrismaVariantLookup implements VariantLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint; sku: string; nameDefault: string | null; productId: bigint } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { publicId },
      select: { id: true, sku: true, productId: true, product: { select: { nameDefault: true } } },
    });
    return row ? { id: row.id, sku: row.sku, nameDefault: row.product.nameDefault, productId: row.productId } : null;
  }

  async byId(
    id: bigint,
  ): Promise<{ sku: string; nameDefault: string | null; productId: bigint; status: 'ACTIVE' | 'INACTIVE'; hsnCode: string | null } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { id },
      select: { sku: true, productId: true, status: true, product: { select: { nameDefault: true, hsnCode: true } } },
    });
    return row
      ? { sku: row.sku, nameDefault: row.product.nameDefault, productId: row.productId, status: row.status, hsnCode: row.product.hsnCode }
      : null;
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
        AND pm.role IN ('GALLERY', 'THUMBNAIL')
      ORDER BY (pm.role = 'THUMBNAIL') DESC, pm.position ASC
      LIMIT 1`;
    return rows[0]?.storage_key ?? null;
  }
}

export class PrismaCustomerGroupLookup implements CustomerGroupLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint } | null> {
    return this.db.customerGroup.findFirst({ where: { code }, select: { id: true } });
  }

  async findDefault(): Promise<{ id: bigint } | null> {
    return this.db.customerGroup.findFirst({ where: { isDefault: true, deletedAt: null }, select: { id: true } });
  }

  async byId(id: bigint): Promise<{ name: string } | null> {
    return this.db.customerGroup.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
  }
}

/** plan/15 Phase 6 — read-only cross-module lookup into company/company_customer (own copy, not company module's own repository). Only ACTIVE companies grant membership here. */
export class PrismaCompanyMembershipLookup implements CompanyMembershipLookup {
  constructor(private readonly db: Db) {}

  async findActiveByCustomerId(
    customerId: bigint,
  ): Promise<{ companyId: bigint; customerGroupId: bigint | null; taxExempt: boolean; creditAccountId: bigint | null } | null> {
    const membership = await this.db.companyCustomer.findUnique({
      where: { customerId },
      select: {
        company: { select: { id: true, status: true, customerGroupId: true, taxExempt: true, deletedAt: true, creditAccount: { select: { id: true } } } },
      },
    });
    if (!membership || membership.company.deletedAt || membership.company.status !== 'ACTIVE') return null;
    return {
      companyId: membership.company.id,
      customerGroupId: membership.company.customerGroupId,
      taxExempt: membership.company.taxExempt,
      creditAccountId: membership.company.creditAccount?.id ?? null,
    };
  }
}

/** plan/15 Phase 6 — order-detail "company" badge/link (own copy, not company module's own repository). */
export class PrismaCompanyLookup implements CompanyLookup {
  constructor(private readonly db: Db) {}

  async byId(companyId: bigint): Promise<{ publicId: string; name: string } | null> {
    return this.db.company.findFirst({ where: { id: companyId }, select: { publicId: true, name: true } });
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

export class PrismaAdminUserLookup implements AdminUserLookup {
  constructor(private readonly db: Db) {}

  async findByPublicId(publicId: string): Promise<{ id: bigint; email: string } | null> {
    return this.db.adminUser.findFirst({ where: { publicId }, select: { id: true, email: true } });
  }
}
