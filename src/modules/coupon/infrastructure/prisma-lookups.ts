import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ProductLookup, CategoryLookup, AttributeLookup } from '../domain/repositories.js';

export class PrismaProductLookup implements ProductLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint } | null> {
    return this.db.product.findFirst({ where: { publicId }, select: { id: true } });
  }

  async byId(id: bigint): Promise<{ publicId: string; name: string | null } | null> {
    const row = await this.db.product.findFirst({ where: { id }, select: { publicId: true, nameDefault: true } });
    return row ? { publicId: row.publicId, name: row.nameDefault } : null;
  }
}

export class PrismaCategoryLookup implements CategoryLookup {
  constructor(private readonly db: Db) {}

  async byPublicId(publicId: string): Promise<{ id: bigint } | null> {
    return this.db.category.findFirst({ where: { publicId }, select: { id: true } });
  }

  async byId(id: bigint): Promise<{ publicId: string; name: string | null } | null> {
    const row = await this.db.category.findFirst({ where: { id }, select: { publicId: true, nameDefault: true } });
    return row ? { publicId: row.publicId, name: row.nameDefault } : null;
  }
}

export class PrismaAttributeLookup implements AttributeLookup {
  constructor(private readonly db: Db) {}

  async byCode(code: string): Promise<{ id: bigint; dataType: string } | null> {
    const row = await this.db.attribute.findFirst({ where: { code }, select: { id: true, dataType: true } });
    return row ? { id: row.id, dataType: row.dataType } : null;
  }

  async byId(id: bigint): Promise<{ code: string; label: string; dataType: string } | null> {
    const row = await this.db.attribute.findFirst({ where: { id }, select: { code: true, label: true, dataType: true } });
    return row ? { code: row.code, label: row.label, dataType: row.dataType } : null;
  }

  async optionLabel(optionId: bigint): Promise<string | null> {
    const row = await this.db.attributeOption.findFirst({ where: { id: optionId }, select: { label: true } });
    return row?.label ?? null;
  }
}
