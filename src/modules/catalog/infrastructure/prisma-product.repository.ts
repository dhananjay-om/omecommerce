import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { Product } from '../domain/product.js';
import type {
  ProductRepository,
  AttributeRepository,
  AttributeInfo,
  CreateAttributeInput,
  UpdateAttributeInput,
  AttributeSetRepository,
  AttributeSetInfo,
  AttributeSetDetail,
  CreateAttributeSetInput,
  AttributeSetGroupInfo,
  ProductVariantRepository,
  VariantInfo,
  GeneratedVariantInput,
  UpdateVariantInput,
  ListProductsFilter,
  ProductListResult,
  UpdateProductInput,
  VariantStockLookup,
  AttributeOptionInfo,
} from '../domain/repositories.js';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../../../shared/domain/errors.js';
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
    const found = await this.db.product.findFirst({ where: { sku, deletedAt: null }, select: { id: true } });
    return found !== null;
  }

  async create(product: Product): Promise<Product> {
    const p = product.props;
    try {
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
    } catch (err) {
      // `sku` is a plain (non-partial) unique DB constraint, so a soft-deleted product's sku
      // stays permanently taken — existsBySku()'s deletedAt-filtered pre-check can't see it.
      // Same backstop as PrismaAttributeRepository.create()/PrismaAttributeSetRepository.createSet().
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`sku already exists: ${p.sku}`);
      }
      throw err;
    }
  }

  async findByPublicId(publicId: string): Promise<Product | null> {
    const row = await this.db.product.findFirst({ where: { publicId, deletedAt: null } });
    if (!row) return null;
    return Product.fromPersistence(toDomainProps(row));
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** True if any variant of this product currently has non-zero on-hand or reserved stock
   *  anywhere — guards deletion, same shape as the warehouse/attribute "in use" guards. */
  async hasStock(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM stock_item si
        JOIN product_variant pv ON pv.id = si.variant_id
        WHERE pv.product_id = ${id} AND (si.on_hand <> 0 OR si.reserved <> 0)
      ) AS exists`;
    return rows[0]?.exists ?? false;
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
      deletedAt: null,
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

  async findBrandSlug(productId: bigint): Promise<string | null> {
    const row = await this.db.product.findFirst({ where: { id: productId }, select: { brand: { select: { slug: true } } } });
    return row?.brand?.slug ?? null;
  }
}

/** Read-only adapter over a product's own variants (admin browse). */
const VARIANT_SELECT = {
  id: true,
  publicId: true,
  sku: true,
  status: true,
  position: true,
  axes: {
    select: {
      attribute: { select: { code: true, label: true } },
      option: { select: { id: true, label: true } },
    },
  },
} as const;

function toVariantInfo(row: {
  id: bigint;
  publicId: string;
  sku: string;
  status: string;
  position: number;
  axes: Array<{ attribute: { code: string; label: string }; option: { id: bigint; label: string } }>;
}): VariantInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    sku: row.sku,
    status: row.status,
    position: row.position,
    axisValues: row.axes.map((a) => ({
      attributeCode: a.attribute.code,
      attributeLabel: a.attribute.label,
      optionId: a.option.id.toString(),
      optionLabel: a.option.label,
    })),
  };
}

/** Read (admin browse) and, for CONFIGURABLE products, write (generate/edit/delete) port over a product's own variants. */
export class PrismaProductVariantRepository implements ProductVariantRepository {
  constructor(private readonly db: Db) {}

  async listByProductId(productId: bigint): Promise<VariantInfo[]> {
    const rows = await this.db.productVariant.findMany({
      where: { productId, deletedAt: null },
      select: VARIANT_SELECT,
      orderBy: { position: 'asc' },
    });
    return rows.map(toVariantInfo);
  }

  async findByPublicId(publicId: string): Promise<VariantInfo | null> {
    const row = await this.db.productVariant.findFirst({ where: { publicId, deletedAt: null }, select: VARIANT_SELECT });
    return row ? toVariantInfo(row) : null;
  }

  async existingAxisCombos(productId: bigint): Promise<Set<string>> {
    const rows = await this.db.variantAxisValue.findMany({
      where: { variant: { productId, deletedAt: null } },
      select: { variantId: true, attributeId: true, optionId: true },
    });
    const byVariant = new Map<string, string[]>();
    for (const r of rows) {
      const key = `${r.attributeId}:${r.optionId}`;
      const variantKey = r.variantId.toString();
      const list = byVariant.get(variantKey) ?? [];
      list.push(key);
      byVariant.set(variantKey, list);
    }
    return new Set([...byVariant.values()].map((keys) => keys.sort().join(',')));
  }

  async bulkCreate(productId: bigint, inputs: GeneratedVariantInput[]): Promise<VariantInfo[]> {
    if (inputs.length === 0) return [];
    try {
      const createdIds = await this.db.$transaction(async (tx) => {
        const maxPos = await tx.productVariant.aggregate({ where: { productId }, _max: { position: true } });
        let nextPosition = (maxPos._max.position ?? -1) + 1;
        const ids: bigint[] = [];
        for (const input of inputs) {
          const row = await tx.productVariant.create({
            data: { productId, sku: input.sku, status: 'ACTIVE', position: nextPosition++ },
          });
          if (input.axisValues.length > 0) {
            await tx.variantAxisValue.createMany({
              data: input.axisValues.map((a) => ({ variantId: row.id, attributeId: a.attributeId, optionId: a.optionId })),
            });
          }
          ids.push(row.id);
        }
        return ids;
      });
      const rows = await this.db.productVariant.findMany({ where: { id: { in: createdIds } }, select: VARIANT_SELECT, orderBy: { position: 'asc' } });
      return rows.map(toVariantInfo);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('one or more generated variant SKUs already exist');
      }
      throw err;
    }
  }

  async update(variantId: bigint, input: UpdateVariantInput): Promise<VariantInfo> {
    try {
      const row = await this.db.productVariant.update({
        where: { id: variantId },
        data: { sku: input.sku, status: input.status as Prisma.ProductVariantUpdateInput['status'] },
        select: VARIANT_SELECT,
      });
      return toVariantInfo(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`variant sku already exists: ${input.sku}`);
      }
      throw err;
    }
  }

  async softDelete(variantId: bigint): Promise<void> {
    await this.db.productVariant.update({ where: { id: variantId }, data: { deletedAt: new Date() } });
  }

  async hasStock(variantId: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM stock_item WHERE variant_id = ${variantId} AND (on_hand <> 0 OR reserved <> 0)
      ) AS exists`;
    return rows[0]?.exists ?? false;
  }
}

/** Read-only per-variant stock check for the storefront PDP (plan/14 Phase 0c). */
export class PrismaVariantStockLookup implements VariantStockLookup {
  constructor(private readonly db: Db) {}

  async isInStock(variantId: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ in_stock: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM stock_item WHERE variant_id = ${variantId} AND available > 0) AS in_stock`;
    return rows[0]?.in_stock ?? false;
  }
}

const ATTRIBUTE_SELECT = {
  id: true,
  code: true,
  label: true,
  dataType: true,
  inputType: true,
  isRequired: true,
  isFilterable: true,
  isSearchable: true,
  isComparable: true,
  isSortable: true,
  isVisiblePdp: true,
  isVisiblePlp: true,
  usedInSearch: true,
  usedInLayeredNav: true,
  isVariantForming: true,
} as const;

/** `code` is a plain (non-partial) unique DB constraint, so it isn't relaxed by `deletedAt` — a soft-deleted
 *  row's code stays permanently taken. findByCode() filters deletedAt so it can't see it, which means the
 *  usual "check then create" duplicate guard can't catch this case; catching P2002 here is the backstop. */
function isCodeUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  if (typeof target === 'string') return target.includes('code');
  if (Array.isArray(target)) return target.includes('code');
  return false;
}

export class PrismaAttributeRepository implements AttributeRepository {
  constructor(private readonly db: Db) {}

  async findByCode(code: string): Promise<AttributeInfo | null> {
    const row = await this.db.attribute.findFirst({ where: { code, deletedAt: null }, select: ATTRIBUTE_SELECT });
    return row;
  }

  async list(): Promise<AttributeInfo[]> {
    return this.db.attribute.findMany({ where: { deletedAt: null }, select: ATTRIBUTE_SELECT, orderBy: { label: 'asc' } });
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.attribute.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async update(id: bigint, input: UpdateAttributeInput): Promise<AttributeInfo> {
    return this.db.attribute.update({ where: { id }, data: input, select: ATTRIBUTE_SELECT });
  }

  async listOptions(code: string): Promise<AttributeOptionInfo[]> {
    const rows = await this.db.attributeOption.findMany({
      where: { attribute: { code, deletedAt: null } },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((o) => ({ id: o.id, value: o.value, label: o.label, swatch: o.swatch, sortOrder: o.sortOrder }));
  }

  async isAssignedToAnySet(id: bigint): Promise<boolean> {
    // A soft-deleted attribute set no longer counts as "in use" — otherwise an attribute
    // that was only ever assigned to a set that's since been deleted becomes permanently
    // undeletable, even though nothing currently references it.
    const found = await this.db.attributeSetAttribute.findFirst({
      where: { attributeId: id, attributeSet: { deletedAt: null } },
      select: { id: true },
    });
    return found !== null;
  }

  async create(input: CreateAttributeInput): Promise<AttributeInfo> {
    try {
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
    } catch (err) {
      if (isCodeUniqueViolation(err)) {
        throw new ConflictError(`attribute code already exists: ${input.code}`);
      }
      throw err;
    }
  }
}

/** Persistence adapter for the attribute-set builder (plan/04 §2.1). */
export class PrismaAttributeSetRepository implements AttributeSetRepository {
  constructor(private readonly db: Db) {}

  async createSet(input: CreateAttributeSetInput): Promise<AttributeSetInfo> {
    try {
      return await this.db.attributeSet.create({
        data: { code: input.code, name: input.name, isDefault: input.isDefault },
        select: { id: true, code: true, name: true, isDefault: true },
      });
    } catch (err) {
      if (isCodeUniqueViolation(err)) {
        throw new ConflictError(`attribute set code already exists: ${input.code}`);
      }
      throw err;
    }
  }

  async findSetByCode(code: string): Promise<AttributeSetInfo | null> {
    return this.db.attributeSet.findFirst({
      where: { code, deletedAt: null },
      select: { id: true, code: true, name: true, isDefault: true },
    });
  }

  async findSetById(id: bigint): Promise<AttributeSetInfo | null> {
    return this.db.attributeSet.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true, name: true, isDefault: true },
    });
  }

  async listSets(): Promise<AttributeSetInfo[]> {
    return this.db.attributeSet.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, isDefault: true },
      orderBy: { name: 'asc' },
    });
  }

  async softDelete(id: bigint): Promise<void> {
    await this.db.attributeSet.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async hasProducts(id: bigint): Promise<boolean> {
    const found = await this.db.product.findFirst({ where: { attributeSetId: id, deletedAt: null }, select: { id: true } });
    return found !== null;
  }

  async removeAttributeAssignment(attributeSetId: bigint, attributeId: bigint): Promise<void> {
    await this.db.attributeSetAttribute.deleteMany({ where: { attributeSetId, attributeId } });
  }

  async getSetDetail(id: bigint): Promise<AttributeSetDetail | null> {
    const set = await this.db.attributeSet.findFirst({
      where: { id, deletedAt: null },
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
                    isVariantForming: true,
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
          isVariantForming: a.attribute.isVariantForming,
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
