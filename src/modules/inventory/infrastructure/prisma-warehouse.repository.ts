import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type {
  WarehouseRepository,
  WarehouseInfo,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  VariantLookup,
} from '../domain/repositories.js';

/** `code` is a plain (non-partial) unique DB constraint, so it isn't relaxed by `deletedAt` — a
 *  soft-deleted warehouse's code stays permanently taken at the DB level even though reads (via the
 *  shared Prisma extension) can no longer see that row. Without this, re-using a deleted warehouse's
 *  code throws an unhandled P2002 instead of a clean 409 — same fix already applied to Attribute/
 *  AttributeSet/Product's create(). */
function isCodeUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  if (typeof target === 'string') return target.includes('code');
  if (Array.isArray(target)) return target.includes('code');
  return false;
}

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
    try {
      const row = await this.db.warehouse.create({
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          priority: input.priority,
        },
      });
      return toInfo(row);
    } catch (err) {
      if (isCodeUniqueViolation(err)) {
        throw new ConflictError(`warehouse code already exists: ${input.code}`);
      }
      throw err;
    }
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
