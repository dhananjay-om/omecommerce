import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { BrandRepository, BrandInfo, CreateBrandInput, UpdateBrandInput } from '../domain/repositories.js';

const BRAND_SELECT = { id: true, publicId: true, slug: true, name: true, description: true, createdAt: true } as const;

/** Persistence adapter for the storefront brand entity (plan/14 Phase 0b). */
export class PrismaBrandRepository implements BrandRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateBrandInput): Promise<BrandInfo> {
    return this.db.brand.create({
      data: { slug: input.slug, name: input.name, description: input.description },
      select: BRAND_SELECT,
    });
  }

  async findById(id: bigint): Promise<BrandInfo | null> {
    return this.db.brand.findFirst({ where: { id, deletedAt: null }, select: BRAND_SELECT });
  }

  async findByPublicId(publicId: string): Promise<BrandInfo | null> {
    return this.db.brand.findFirst({ where: { publicId, deletedAt: null }, select: BRAND_SELECT });
  }

  async findBySlug(slug: string): Promise<BrandInfo | null> {
    return this.db.brand.findFirst({ where: { slug, deletedAt: null }, select: BRAND_SELECT });
  }

  async list(): Promise<BrandInfo[]> {
    return this.db.brand.findMany({ where: { deletedAt: null }, select: BRAND_SELECT, orderBy: { name: 'asc' } });
  }

  async update(id: bigint, input: UpdateBrandInput): Promise<BrandInfo> {
    return this.db.brand.update({
      where: { id },
      data: { name: input.name, description: input.description },
      select: BRAND_SELECT,
    });
  }

  async hasProducts(id: bigint): Promise<boolean> {
    const found = await this.db.product.findFirst({ where: { brandId: id, deletedAt: null }, select: { id: true } });
    return found !== null;
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.brand.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
