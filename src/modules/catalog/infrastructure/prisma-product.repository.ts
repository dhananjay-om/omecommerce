import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { Product } from '../domain/product.js';
import type { ProductRepository, AttributeRepository, AttributeInfo } from '../domain/repositories.js';

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly db: Db) {}

  async existsBySku(sku: string): Promise<boolean> {
    const found = await this.db.product.findFirst({ where: { sku }, select: { id: true } });
    return found !== null;
  }

  async create(product: Product): Promise<Product> {
    const p = product.props;
    const row = await this.db.product.create({
      data: {
        type: p.type,
        sku: p.sku,
        attributeSetId: p.attributeSetId,
        status: p.status,
        visibility: p.visibility,
        nameDefault: p.nameDefault,
        isDigital: p.isDigital,
        isVirtual: p.isVirtual,
      },
    });
    return Product.fromPersistence({
      id: row.id,
      publicId: row.publicId,
      type: row.type,
      sku: row.sku,
      attributeSetId: row.attributeSetId,
      status: row.status,
      visibility: row.visibility,
      nameDefault: row.nameDefault,
      isDigital: row.isDigital,
      isVirtual: row.isVirtual,
    });
  }

  async findByPublicId(publicId: string): Promise<Product | null> {
    const row = await this.db.product.findFirst({ where: { publicId } });
    if (!row) return null;
    return Product.fromPersistence({
      id: row.id,
      publicId: row.publicId,
      type: row.type,
      sku: row.sku,
      attributeSetId: row.attributeSetId,
      status: row.status,
      visibility: row.visibility,
      nameDefault: row.nameDefault,
      isDigital: row.isDigital,
      isVirtual: row.isVirtual,
    });
  }
}

export class PrismaAttributeRepository implements AttributeRepository {
  constructor(private readonly db: Db) {}

  async findByCode(code: string): Promise<AttributeInfo | null> {
    const row = await this.db.attribute.findFirst({
      where: { code },
      select: { id: true, code: true, dataType: true },
    });
    return row ? { id: row.id, code: row.code, dataType: row.dataType } : null;
  }
}
