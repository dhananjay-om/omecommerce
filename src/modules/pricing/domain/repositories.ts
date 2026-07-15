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

export interface PriceListRepository {
  create(input: CreatePriceListInput): Promise<PriceListInfo>;
  findByCode(code: string): Promise<PriceListInfo | null>;
  setProductPrice(priceListId: bigint, variantId: bigint, price: string): Promise<void>;
  setPriceTier(priceListId: bigint, variantId: bigint, minQty: number, price: string): Promise<void>;
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
