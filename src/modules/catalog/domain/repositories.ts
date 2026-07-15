import type { AttributeDataType, AttributeInputType, ScopeType } from '@prisma/client';
import type { Product } from './product.js';
import type { AttributeValueColumns } from './attribute-value.js';

/** Persistence port for the Product aggregate (implemented in infrastructure). */
export interface ProductRepository {
  existsBySku(sku: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  findByPublicId(publicId: string): Promise<Product | null>;
}

export interface AttributeInfo {
  id: bigint;
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
}

export interface CreateAttributeOptionInput {
  value: string;
  label: string;
  swatch?: string | null;
  sortOrder?: number;
}

export interface CreateAttributeInput {
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  isComparable?: boolean;
  isSortable?: boolean;
  isVisiblePdp?: boolean;
  isVisiblePlp?: boolean;
  usedInSearch?: boolean;
  usedInLayeredNav?: boolean;
  isVariantForming?: boolean;
  options?: CreateAttributeOptionInput[];
}

/** Read/write port for attribute definitions + scoped value writes/reads. */
export interface AttributeRepository {
  findByCode(code: string): Promise<AttributeInfo | null>;
  create(input: CreateAttributeInput): Promise<AttributeInfo>;
}

export interface AttributeSetInfo {
  id: bigint;
  code: string;
  name: string;
}

export interface CreateAttributeSetInput {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface AttributeSetGroupInfo {
  id: bigint;
  attributeSetId: bigint;
  name: string;
  sortOrder: number;
}

/**
 * Persistence port for the attribute-set builder (plan/04 §2.1): sets, their
 * groups (tabs/sections in the dynamic product editor), and the junction that
 * assigns a reusable Attribute into a specific set's group + sort position.
 */
export interface AttributeSetRepository {
  createSet(input: CreateAttributeSetInput): Promise<AttributeSetInfo>;
  findSetByCode(code: string): Promise<AttributeSetInfo | null>;
  findSetById(id: bigint): Promise<AttributeSetInfo | null>;
  createGroup(attributeSetId: bigint, name: string, sortOrder: number): Promise<AttributeSetGroupInfo>;
  findGroupByName(attributeSetId: bigint, name: string): Promise<AttributeSetGroupInfo | null>;
  findGroupById(attributeSetId: bigint, groupId: bigint): Promise<AttributeSetGroupInfo | null>;
  assignAttribute(attributeSetId: bigint, groupId: bigint, attributeId: bigint, sortOrder: number): Promise<void>;
  isAttributeAssigned(attributeSetId: bigint, attributeId: bigint): Promise<boolean>;
}

export interface WriteScopedValueInput {
  productId: bigint;
  attributeId: bigint;
  scope: ScopeType;
  websiteId: bigint | null;
  storeId: bigint | null;
  storeViewId: bigint | null;
  columns: AttributeValueColumns;
}

export interface ResolvedAttribute {
  attributeId: bigint;
  code: string;
  dataType: AttributeDataType;
  columns: AttributeValueColumns;
}

/**
 * Scope-aware attribute value store. `resolveForStoreView` runs the single-pass
 * DISTINCT ON (attribute_id) ORDER BY scope_rank DESC query (plan/02 §5).
 */
export interface ProductAttributeStore {
  upsertScopedValue(input: WriteScopedValueInput): Promise<void>;
  resolveForStoreView(
    productId: bigint,
    chain: { websiteId: bigint; storeId: bigint; storeViewId: bigint },
  ): Promise<ResolvedAttribute[]>;
}
