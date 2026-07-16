import type { AttributeDataType, AttributeInputType, ScopeType, ProductType, ProductStatus, ProductVisibility } from '@prisma/client';
import type { Product } from './product.js';
import type { AttributeValueColumns } from './attribute-value.js';

export interface ProductListItem {
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: Date;
}

export interface ListProductsFilter {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  /** Matches sku/name, case-insensitive substring (admin browse — not the storefront search index). */
  search?: string;
}

export interface ProductListResult {
  total: number;
  page: number;
  pageSize: number;
  products: ProductListItem[];
}

export interface UpdateProductInput {
  nameDefault?: string | null;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  weight?: string | null;
  attributeSetId?: bigint;
}

/** Persistence port for the Product aggregate (implemented in infrastructure). */
export interface ProductRepository {
  existsBySku(sku: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  findByPublicId(publicId: string): Promise<Product | null>;
  update(publicId: string, input: UpdateProductInput): Promise<Product>;
  list(filter: ListProductsFilter): Promise<ProductListResult>;
}

export interface VariantInfo {
  publicId: string;
  sku: string;
  status: string;
  position: number;
}

/** Read-only port over a product's own variants (admin browse — plan/12 Admin UI). */
export interface ProductVariantRepository {
  listByProductId(productId: bigint): Promise<VariantInfo[]>;
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
  isDefault: boolean;
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

export interface AttributeOptionInfo {
  value: string;
  label: string;
  swatch: string | null;
  sortOrder: number;
}

export interface AttributeSetAttributeDetail {
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
  isRequired: boolean;
  sortOrder: number;
  options: AttributeOptionInfo[];
}

export interface AttributeSetGroupDetail {
  id: bigint;
  name: string;
  sortOrder: number;
  attributes: AttributeSetAttributeDetail[];
}

export interface AttributeSetDetail extends AttributeSetInfo {
  groups: AttributeSetGroupDetail[];
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
  /** Admin browse (plan/12 Admin UI) — populates the attribute-set picker on the create-product form. */
  listSets(): Promise<AttributeSetInfo[]>;
  /** Admin dynamic-attribute-form support (plan/13 Phase G) — groups + their assigned attributes (with data type/options), for rendering typed inputs on the product create/edit form. */
  getSetDetail(id: bigint): Promise<AttributeSetDetail | null>;
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
  /**
   * Admin detail view (plan/12 Admin UI) — GLOBAL-scope values only, no store
   * view chain needed. Read-only for this pass; a full attribute-value
   * editing UI covering WEBSITE/STORE/STORE_VIEW overrides is real, separate
   * future work.
   */
  resolveGlobalValues(productId: bigint): Promise<ResolvedAttribute[]>;
}
