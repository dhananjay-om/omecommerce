import type { PriceListType } from '@prisma/client';

/** Read-only cross-module lookups (each module resolves its own dependencies —
 * same pattern as inventory's PrismaVariantLookup — rather than importing another
 * module's repositories directly). */
export interface VariantLookup {
  byPublicId(publicId: string): Promise<{ id: bigint } | null>;
}

export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
}

/** price_list.currency has a raw-SQL FK to currency(code) (see prisma/sql/0003_pricing_raw.sql) —
 *  without checking this first, an unregistered currency falls through to a bare Prisma FK
 *  violation instead of a clean NotFoundError (this was a real production bug: the "New Price
 *  List" dialog accepts any 3-letter code, but only currencies actually seeded into the
 *  `currency` table — just USD, out of the box — can be used). */
export interface CurrencyLookup {
  byCode(code: string): Promise<{ code: string } | null>;
}

export interface CustomerGroupInfo {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
}

export interface CreateCustomerGroupInput {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface CustomerGroupRepository {
  create(input: CreateCustomerGroupInput): Promise<CustomerGroupInfo>;
  findByCode(code: string): Promise<CustomerGroupInfo | null>;
}

export interface PriceListInfo {
  id: bigint;
  publicId: string;
  code: string;
  name: string;
  currency: string;
  type: PriceListType;
  priority: number;
  isActive: boolean;
}

export interface CreatePriceListInput {
  code: string;
  name: string;
  currency: string;
  type?: PriceListType;
  priority?: number;
  customerGroupId?: bigint | null;
  websiteId?: bigint | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface UpdatePriceListInput {
  name?: string;
  currency?: string;
  type?: PriceListType;
  priority?: number;
  isActive?: boolean;
}

export interface VariantPriceRow {
  priceListCode: string;
  priceListName: string;
  currency: string;
  /** null when no ProductPrice row exists yet for this variant in this list. */
  price: string | null;
}

export interface PriceListRepository {
  create(input: CreatePriceListInput): Promise<PriceListInfo>;
  findByCode(code: string): Promise<PriceListInfo | null>;
  list(): Promise<PriceListInfo[]>;
  update(id: bigint, input: UpdatePriceListInput): Promise<PriceListInfo>;
  /** Soft-delete only, same as WarehouseRepository.softDelete: sets deletedAt + isActive=false. Safe to
   *  do even for a price list with prices set — PriceResolver already filters is_active/deleted_at, and
   *  ProductPrice/PriceTier rows are kept (not cascaded), so reactivating restores the same prices. */
  softDelete(id: bigint): Promise<void>;
  setProductPrice(priceListId: bigint, variantId: bigint, price: string): Promise<void>;
  setPriceTier(priceListId: bigint, variantId: bigint, minQty: number, price: string): Promise<void>;
  /** Every active price list's price for one variant (product-edit page) — lists not yet priced for this variant still appear, with price: null. */
  listPricesForVariant(variantId: bigint): Promise<VariantPriceRow[]>;
}

export interface ResolvePriceInput {
  variantId: bigint;
  qty: number;
  currency: string;
  customerGroupId: bigint | null;
  websiteId: bigint | null;
  asOf: Date;
}

export interface ResolvedPrice {
  price: string;
  priceListId: bigint;
  priceListCode: string;
  source: 'tier' | 'base';
}

/**
 * The pricing resolver (plan/01 §7): highest-priority MATCHING price list wins,
 * where "matching" also requires that price list to actually price this variant
 * (via a tier row for the given qty, or a base row) — not just scope-match. A naive
 * single-table join would silently skip a tier-only price list with no base row;
 * see prisma/schema/pricing.prisma header + the schema-review finding it fixes.
 */
export interface PriceResolver {
  resolve(input: ResolvePriceInput): Promise<ResolvedPrice | null>;
}
