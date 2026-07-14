import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WarehouseRepository, WarehouseInfo, CreateWarehouseInput, VariantLookup } from '../domain/repositories.js';

export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateWarehouseInput): Promise<WarehouseInfo> {
    const row = await this.db.warehouse.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        priority: input.priority,
      },
    });
    return { id: row.id, publicId: row.publicId, code: row.code, name: row.name, type: row.type };
  }

  async findByCode(code: string): Promise<WarehouseInfo | null> {
    const row = await this.db.warehouse.findFirst({ where: { code } });
    return row
      ? { id: row.id, publicId: row.publicId, code: row.code, name: row.name, type: row.type }
      : null;
  }
}

/** Read-only cross-module lookup: resolves a catalog variant's publicId. */
export class PrismaVariantLookup implements VariantLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint; sku: string } | null> {
    const row = await this.db.productVariant.findFirst({
      where: { publicId },
      select: { id: true, sku: true },
    });
    return row;
  }
}
