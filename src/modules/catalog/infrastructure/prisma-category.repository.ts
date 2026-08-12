import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  CategoryRepository,
  CategoryInfo,
  CreateCategoryInput,
  UpdateCategoryInput,
  ProductCategoryRepository,
} from '../domain/repositories.js';

const CATEGORY_SELECT = {
  id: true,
  publicId: true,
  parentId: true,
  slug: true,
  type: true,
  sortMode: true,
  position: true,
  nameDefault: true,
  createdAt: true,
  parent: { select: { publicId: true } },
} as const;

type CategoryRow = {
  id: bigint;
  publicId: string;
  parentId: bigint | null;
  slug: string;
  type: CategoryInfo['type'];
  sortMode: CategoryInfo['sortMode'];
  position: number;
  nameDefault: string | null;
  createdAt: Date;
  parent: { publicId: string } | null;
};

function mapRow(row: CategoryRow): CategoryInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    parentId: row.parentId,
    parentPublicId: row.parent?.publicId ?? null,
    slug: row.slug,
    type: row.type,
    sortMode: row.sortMode,
    position: row.position,
    nameDefault: row.nameDefault,
    createdAt: row.createdAt,
  };
}

/** Persistence adapter for the category tree (plan/13 Phase K). */
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCategoryInput): Promise<CategoryInfo> {
    const row = await this.db.category.create({
      data: {
        parentId: input.parentId ?? null,
        nameDefault: input.nameDefault,
        slug: input.slug,
        type: input.type,
        sortMode: input.sortMode,
        position: input.position,
      },
      select: CATEGORY_SELECT,
    });
    return mapRow(row);
  }

  async findById(id: bigint): Promise<CategoryInfo | null> {
    const row = await this.db.category.findFirst({ where: { id, deletedAt: null }, select: CATEGORY_SELECT });
    return row ? mapRow(row) : null;
  }

  async findByPublicId(publicId: string): Promise<CategoryInfo | null> {
    const row = await this.db.category.findFirst({ where: { publicId, deletedAt: null }, select: CATEGORY_SELECT });
    return row ? mapRow(row) : null;
  }

  async findBySlug(slug: string): Promise<CategoryInfo | null> {
    const row = await this.db.category.findFirst({ where: { slug, deletedAt: null }, select: CATEGORY_SELECT });
    return row ? mapRow(row) : null;
  }

  async list(): Promise<CategoryInfo[]> {
    const rows = await this.db.category.findMany({
      where: { deletedAt: null },
      select: CATEGORY_SELECT,
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
    });
    return rows.map(mapRow);
  }

  async getAncestors(id: bigint): Promise<CategoryInfo[]> {
    const links = await this.db.$queryRaw<Array<{ ancestor_id: bigint }>>`
      SELECT ancestor_id FROM category_closure
       WHERE descendant_id = ${id} AND depth > 0
       ORDER BY depth DESC`;
    if (links.length === 0) return [];

    const ids = links.map((l) => l.ancestor_id);
    const rows = await this.db.category.findMany({ where: { id: { in: ids }, deletedAt: null }, select: CATEGORY_SELECT });
    const byId = new Map(rows.map((r) => [r.id.toString(), mapRow(r)]));
    return ids.map((i) => byId.get(i.toString())).filter((c): c is CategoryInfo => c !== undefined);
  }

  async update(id: bigint, input: UpdateCategoryInput): Promise<CategoryInfo> {
    const row = await this.db.category.update({
      where: { id },
      data: { nameDefault: input.nameDefault, sortMode: input.sortMode, position: input.position },
      select: CATEGORY_SELECT,
    });
    return mapRow(row);
  }

  async reparent(id: bigint, newParentId: bigint | null): Promise<CategoryInfo> {
    await this.db.$executeRaw`SELECT category_reparent(${id}, ${newParentId})`;
    const row = await this.db.category.findFirstOrThrow({ where: { id }, select: CATEGORY_SELECT });
    return mapRow(row);
  }

  async hasChildren(id: bigint): Promise<boolean> {
    const found = await this.db.category.findFirst({ where: { parentId: id, deletedAt: null }, select: { id: true } });
    return found !== null;
  }

  async hasProducts(id: bigint): Promise<boolean> {
    const found = await this.db.productCategory.findFirst({ where: { categoryId: id }, select: { productId: true } });
    return found !== null;
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

/** Persistence adapter for a product's category assignments (plan/13 Phase K). */
export class PrismaProductCategoryRepository implements ProductCategoryRepository {
  constructor(private readonly db: Db) {}

  async setForProduct(productId: bigint, categoryIds: bigint[]): Promise<void> {
    await this.db.$transaction([
      this.db.productCategory.deleteMany({ where: { productId } }),
      this.db.productCategory.createMany({
        data: categoryIds.map((categoryId, i) => ({ productId, categoryId, position: i })),
      }),
    ]);
  }

  async listCategoryPublicIdsForProduct(productId: bigint): Promise<string[]> {
    const rows = await this.db.productCategory.findMany({
      where: { productId },
      select: { category: { select: { publicId: true } } },
      orderBy: { position: 'asc' },
    });
    return rows.map((r) => r.category.publicId);
  }
}
