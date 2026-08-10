import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  WarehouseRepository,
  WarehouseInfo,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  VariantLookup,
} from '../domain/repositories.js';

function toInfo(row: {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  type: WarehouseInfo['type'];
  priority: number;
  isActive: boolean;
}): WarehouseInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    code: row.code,
    name: row.name,
    type: row.type,
    priority: row.priority,
    isActive: row.isActive,
  };
}

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
    return toInfo(row);
  }

  async findByCode(code: string): Promise<WarehouseInfo | null> {
    const row = await this.db.warehouse.findFirst({ where: { code } });
    return row ? toInfo(row) : null;
  }

  async list(): Promise<WarehouseInfo[]> {
    const rows = await this.db.warehouse.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    return rows.map(toInfo);
  }

  async update(id: bigint, input: UpdateWarehouseInput): Promise<WarehouseInfo> {
    const row = await this.db.warehouse.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        priority: input.priority,
        isActive: input.isActive,
      },
    });
    return toInfo(row);
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
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
