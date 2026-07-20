import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { Product } from '../domain/product.js';
import type {
  ProductRepository,
  AttributeRepository,
  AttributeInfo,
  CreateAttributeInput,
  AttributeSetRepository,
  AttributeSetInfo,
  AttributeSetDetail,
  CreateAttributeSetInput,
  AttributeSetGroupInfo,
  ProductVariantRepository,
  VariantInfo,
  ListProductsFilter,
  ProductListResult,
  UpdateProductInput,
} from '../domain/repositories.js';
import { Prisma } from '@prisma/client';
import type { Product as PrismaProductRow } from '@prisma/client';

function toDomainProps(row: PrismaProductRow) {
  return {
    id: row.id,
    publicId: row.publicId,
    type: row.type,
    sku: row.sku,
    attributeSetId: row.attributeSetId,
    status: row.status,
    visibility: row.visibility,
    nameDefault: row.nameDefault,
    weight: row.weight?.toString() ?? null,
    isDigital: row.isDigital,
    isVirtual: row.isVirtual,
  };
}

/**
 * Product types that are sold as a single sellable unit with no distinct variant
 * axes. Inventory (plan/07 §1) keys stock to a variant, so these types get an
 * implicit ProductVariant (same SKU) created alongside the product. CONFIGURABLE
 * and BUNDLE products get their variants/components created explicitly later.
 */
const IMPLICIT_VARIANT_TYPES = new Set(['SIMPLE', 'DIGITAL', 'VIRTUAL']);

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly db: Db) {}

  async existsBySku(sku: string): Promise<boolean> {
    const found = await this.db.product.findFirst({ where: { sku }, select: { id: true } });
    return found !== null;
  }

  async create(product: Product): Promise<Product> {
    const p = product.props;
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          type: p.type,
          sku: p.sku,
          attributeSetId: p.attributeSetId,
          status: p.status,
          visibility: p.visibility,
          nameDefault: p.nameDefault,
          weight: p.weight,
          isDigital: p.isDigital,
          isVirtual: p.isVirtual,
        },
      });
      if (IMPLICIT_VARIANT_TYPES.has(created.type)) {
        await tx.productVariant.create({
          data: { productId: created.id, sku: created.sku, status: 'ACTIVE' },
        });
      }
      return created;
    });
    return Product.fromPersistence(toDomainProps(row));
  }

  async findByPublicId(publicId: string): Promise<Product | null> {
    const row = await this.db.product.findFirst({ where: { publicId } });
    if (!row) return null;
    return Product.fromPersistence(toDomainProps(row));
  }

  async update(publicId: string, input: UpdateProductInput): Promise<Product> {
    const row = await this.db.product.update({
      where: { publicId },
      data: {
        nameDefault: input.nameDefault,
        status: input.status,
        visibility: input.visibility,
        weight: input.weight,
        attributeSetId: input.attributeSetId,
        brandId: input.brandId,
      },
    });
    return Product.fromPersistence(toDomainProps(row));
  }

  async list(filter: ListProductsFilter): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = {
      status: filter.status,
      type: filter.type,
      attributeSetId: filter.attributeSetId,
      ...(filter.search
        ? { OR: [{ sku: { contains: filter.search, mode: 'insensitive' } }, { nameDefault: { contains: filter.search, mode: 'insensitive' } }] }
        : {}),
    };

    const [total, rows] = await this.db.$transaction([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        select: { id: true, publicId: true, sku: true, nameDefault: true, type: true, status: true, createdAt: true },
        orderBy: { [filter.sortBy ?? 'createdAt']: filter.sortDir ?? 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    const stockByProduct = await this.sumStockByProduct(rows.map((r) => r.id));

    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      products: rows.map((r) => {
        const stock = stockByProduct.get(r.id.toString()) ?? { onHand: 0, available: 0 };
        return {
          id: r.id,
          publicId: r.publicId,
          sku: r.sku,
          name: r.nameDefault,
          type: r.type,
          status: r.status,
          createdAt: r.createdAt,
          quantity: stock.onHand,
          salableQuantity: stock.available,
        };
      }),
    };
  }

  /** Sums on-hand/available stock across every variant and warehouse for a page of
   * products — a LEFT JOIN so a product with zero variants (a CONFIGURABLE with no
   * variants created yet) or zero stock rows still doesn't drop out of the result. */
  private async sumStockByProduct(productIds: bigint[]): Promise<Map<string, { onHand: number; available: number }>> {
    const result = new Map<string, { onHand: number; available: number }>();
    if (productIds.length === 0) return result;

    const rows = await this.db.$queryRaw<Array<{ product_id: bigint; on_hand_sum: bigint; available_sum: bigint }>>`
      SELECT pv.product_id AS product_id,
             COALESCE(SUM(si.on_hand), 0) AS on_hand_sum,
             COALESCE(SUM(si.available), 0) AS available_sum
        FROM product_variant pv
        LEFT JOIN stock_item si ON si.variant_id = pv.id
       WHERE pv.product_id IN (${Prisma.join(productIds)})
       GROUP BY pv.product_id`;

    for (const row of rows) {
      result.set(row.product_id.toString(), { onHand: Number(row.on_hand_sum), available: Number(row.available_sum) });
    }
    return result;
  }
}

/** Read-only adapter over a product's own variants (admin browse). */
export class PrismaProductVariantRepository implements ProductVariantRepository {
  constructor(private readonly db: Db) {}

  async listByProductId(productId: bigint): Promise<VariantInfo[]> {
    return this.db.productVariant.findMany({
      where: { productId },
      select: { publicId: true, sku: true, status: true, position: true },
      orderBy: { position: 'asc' },
    });
  }
}

const ATTRIBUTE_SELECT = { id: true, code: true, label: true, dataType: true, inputType: true } as const;

export class PrismaAttributeRepository implements AttributeRepository {
  constructor(private readonly db: Db) {}

  async findByCode(code: string): Promise<AttributeInfo | null> {
    const row = await this.db.attribute.findFirst({ where: { code }, select: ATTRIBUTE_SELECT });
    return row;
  }

  async list(): Promise<AttributeInfo[]> {
    return this.db.attribute.findMany({ select: ATTRIBUTE_SELECT, orderBy: { label: 'asc' } });
  }

  async create(input: CreateAttributeInput): Promise<AttributeInfo> {
    const row = await this.db.attribute.create({
      data: {
        code: input.code,
        label: input.label,
        dataType: input.dataType,
        inputType: input.inputType,
        isRequired: input.isRequired,
        isFilterable: input.isFilterable,
        isSearchable: input.isSearchable,
        isComparable: input.isComparable,
        isSortable: input.isSortable,
        isVisiblePdp: input.isVisiblePdp,
        isVisiblePlp: input.isVisiblePlp,
        usedInSearch: input.usedInSearch,
        usedInLayeredNav: input.usedInLayeredNav,
        isVariantForming: input.isVariantForming,
        options: input.options?.length
          ? {
              create: input.options.map((o) => ({
                value: o.value,
                label: o.label,
                swatch: o.swatch,
                sortOrder: o.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      select: ATTRIBUTE_SELECT,
    });
    return row;
  }
}

/** Persistence adapter for the attribute-set builder (plan/04 §2.1). */
export class PrismaAttributeSetRepository implements AttributeSetRepository {
  constructor(private readonly db: Db) {}

  async createSet(input: CreateAttributeSetInput): Promise<AttributeSetInfo> {
    return this.db.attributeSet.create({
      data: { code: input.code, name: input.name, isDefault: input.isDefault },
      select: { id: true, code: true, name: true, isDefault: true },
    });
  }

  async findSetByCode(code: string): Promise<AttributeSetInfo | null> {
    return this.db.attributeSet.findFirst({ where: { code }, select: { id: true, code: true, name: true, isDefault: true } });
  }

  async findSetById(id: bigint): Promise<AttributeSetInfo | null> {
    return this.db.attributeSet.findFirst({ where: { id }, select: { id: true, code: true, name: true, isDefault: true } });
  }

  async listSets(): Promise<AttributeSetInfo[]> {
    return this.db.attributeSet.findMany({ select: { id: true, code: true, name: true, isDefault: true }, orderBy: { name: 'asc' } });
  }

  async getSetDetail(id: bigint): Promise<AttributeSetDetail | null> {
    const set = await this.db.attributeSet.findFirst({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        isDefault: true,
        groups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            sortOrder: true,
            attributes: {
              orderBy: { sortOrder: 'asc' },
              select: {
                sortOrder: true,
                isRequiredOverride: true,
                attribute: {
                  select: {
                    code: true,
                    label: true,
                    dataType: true,
                    inputType: true,
                    isRequired: true,
                    options: {
                      orderBy: { sortOrder: 'asc' },
                      select: { id: true, value: true, label: true, swatch: true, sortOrder: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!set) return null;
    return {
      id: set.id,
      code: set.code,
      name: set.name,
      isDefault: set.isDefault,
      groups: set.groups.map((g) => ({
        id: g.id,
        name: g.name,
        sortOrder: g.sortOrder,
        attributes: g.attributes.map((a) => ({
          code: a.attribute.code,
          label: a.attribute.label,
          dataType: a.attribute.dataType,
          inputType: a.attribute.inputType,
          isRequired: a.isRequiredOverride ?? a.attribute.isRequired,
          sortOrder: a.sortOrder,
          options: a.attribute.options,
        })),
      })),
    };
  }

  async createGroup(attributeSetId: bigint, name: string, sortOrder: number): Promise<AttributeSetGroupInfo> {
    return this.db.attributeSetGroup.create({
      data: { attributeSetId, name, sortOrder },
      select: { id: true, attributeSetId: true, name: true, sortOrder: true },
    });
  }

  async findGroupByName(attributeSetId: bigint, name: string): Promise<AttributeSetGroupInfo | null> {
    return this.db.attributeSetGroup.findFirst({
      where: { attributeSetId, name },
      select: { id: true, attributeSetId: true, name: true, sortOrder: true },
    });
  }

  async findGroupById(attributeSetId: bigint, groupId: bigint): Promise<AttributeSetGroupInfo | null> {
    return this.db.attributeSetGroup.findFirst({
      where: { id: groupId, attributeSetId },
      select: { id: true, attributeSetId: true, name: true, sortOrder: true },
    });
  }

  async assignAttribute(attributeSetId: bigint, groupId: bigint, attributeId: bigint, sortOrder: number): Promise<void> {
    await this.db.attributeSetAttribute.create({
      data: { attributeSetId, groupId, attributeId, sortOrder },
    });
  }

  async isAttributeAssigned(attributeSetId: bigint, attributeId: bigint): Promise<boolean> {
    const found = await this.db.attributeSetAttribute.findFirst({
      where: { attributeSetId, attributeId },
      select: { id: true },
    });
    return found !== null;
  }
}
