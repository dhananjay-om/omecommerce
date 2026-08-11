import type {
  AttributeDataType,
  AttributeInputType,
  ScopeType,
  ProductType,
  ProductStatus,
  ProductVisibility,
  CategoryType,
  CategorySortMode,
  MediaKind,
  ProductMediaRole,
} from '@prisma/client';
import type { Product } from './product.js';
import type { AttributeValueColumns } from './attribute-value.js';

export interface ProductListItem {
  /** Internal id — used by the use-case layer to batch-lookup thumbnails; never serialized to the API response. */
  id: bigint;
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: Date;
  /** Sum of on-hand stock across all this product's variants and warehouses. */
  quantity: number;
  /** Sum of available (on_hand - reserved) stock across all variants/warehouses. */
  salableQuantity: number;
}

export type ListProductsSortBy = 'sku' | 'nameDefault' | 'createdAt' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface ListProductsFilter {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  type?: ProductType;
  attributeSetId?: bigint;
  /** Matches sku/name, case-insensitive substring (admin browse — not the storefront search index). */
  search?: string;
  sortBy?: ListProductsSortBy;
  sortDir?: SortDirection;
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
  /** `undefined` leaves it untouched; `null` clears it (plan/14 Phase 0b). */
  brandId?: bigint | null;
}

/** Persistence port for the Product aggregate (implemented in infrastructure). */
export interface ProductRepository {
  existsBySku(sku: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  findByPublicId(publicId: string): Promise<Product | null>;
  update(publicId: string, input: UpdateProductInput): Promise<Product>;
  list(filter: ListProductsFilter): Promise<ProductListResult>;
  /** Storefront PDP (plan/14 Phase 0c) — the assigned brand's slug, if any. A small cross-aggregate convenience read, same precedent as sumStockByProduct's raw joins. */
  findBrandSlug(productId: bigint): Promise<string | null>;
  /** Soft-delete only — order_line/cart_line/stock_item/product_price/price_tier are all ON DELETE
   *  RESTRICT against product_variant.id, so a hard delete would fail once a variant has any
   *  history. Order lines snapshot sku/name/price at placement and Order is never soft-deleted
   *  itself, so past orders keep displaying correctly regardless of this. Doesn't cascade to the
   *  product's own variants, same as AttributeSet's softDelete not cascading to its groups. */
  softDelete(id: bigint): Promise<void>;
  /** True if any variant currently has non-zero on-hand or reserved stock anywhere — guards deletion. */
  hasStock(id: bigint): Promise<boolean>;
}

export interface VariantInfo {
  /** Internal id — needed to resolve price/stock for a specific variant (plan/14 Phase 0c); never serialized directly. */
  id: bigint;
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
  /** Admin browse (plan/13 Phase L) — the reusable-attribute library + "assign existing attribute" picker. */
  list(): Promise<AttributeInfo[]>;
  /** Soft-delete only — attribute_set_attribute.attribute_id and product_attribute_value.attribute_id
   *  are both ON DELETE RESTRICT, so a hard delete would fail the moment this attribute has ever been
   *  assigned or valued. Guarded in the use-case via isAssignedToAnySet, not here. */
  softDelete(id: bigint): Promise<void>;
  /** True if this attribute is currently assigned into any attribute set's group — guards deletion. */
  isAssignedToAnySet(id: bigint): Promise<boolean>;
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
  /** The AttributeOption row's own id — SELECT attribute values are stored as this
   * id via product_attribute_value.value_int (see attribute-value.ts's REF_TYPES),
   * not the `value` string below, which is just the option's display key. */
  id: bigint;
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
  /** Removes the assignment row only — never touches the Attribute itself or any product's stored values. */
  removeAttributeAssignment(attributeSetId: bigint, attributeId: bigint): Promise<void>;
  /** Soft-delete only — product.attribute_set_id is a required, ON DELETE RESTRICT FK, so a hard
   *  delete would fail the moment any product uses this set. Guarded in the use-case via hasProducts. */
  softDelete(id: bigint): Promise<void>;
  /** True if any non-deleted product currently uses this set — guards deletion. */
  hasProducts(id: bigint): Promise<boolean>;
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
  /** All inputs commit atomically in one transaction (plan/13 Phase H). */
  upsertScopedValues(inputs: WriteScopedValueInput[]): Promise<void>;
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

export interface CategoryInfo {
  id: bigint;
  publicId: string;
  parentId: bigint | null;
  /** The parent's own publicId — external callers address categories by publicId, never the internal bigint. */
  parentPublicId: string | null;
  /** URL-safe storefront identifier (plan/14 Phase 0a) — unique, always present. */
  slug: string;
  type: CategoryType;
  sortMode: CategorySortMode;
  position: number;
  nameDefault: string | null;
  createdAt: Date;
}

export interface CreateCategoryInput {
  parentId?: bigint | null;
  nameDefault?: string | null;
  /** Caller-supplied or use-case-generated (slugified nameDefault, disambiguated on collision) — the repository never invents one. */
  slug: string;
  type?: CategoryType;
  sortMode?: CategorySortMode;
  position?: number;
}

export interface UpdateCategoryInput {
  nameDefault?: string | null;
  sortMode?: CategorySortMode;
  position?: number;
}

/**
 * Persistence port for the category tree (plan/13 Phase K). Ordinary CRUD goes
 * through the typed Prisma client (the `path` ltree column is `Unsupported`,
 * simply invisible to it — `category_before_insert`/`category_after_insert`
 * triggers fill it and the closure table automatically on every INSERT).
 * `reparent` is the one operation that needs raw SQL, calling the existing
 * `category_reparent(child, new_parent)` stored procedure rather than
 * reimplementing path/closure-rewrite logic at the application layer.
 */
export interface CategoryRepository {
  create(input: CreateCategoryInput): Promise<CategoryInfo>;
  findById(id: bigint): Promise<CategoryInfo | null>;
  findByPublicId(publicId: string): Promise<CategoryInfo | null>;
  /** Storefront lookup (plan/14 Phase 0a) — categories are addressed by slug in URLs, not publicId. */
  findBySlug(slug: string): Promise<CategoryInfo | null>;
  /** Admin browse — the full flat list; the tree is built from `parentId` in application/frontend code (small, admin-scale table). */
  list(): Promise<CategoryInfo[]>;
  /** Storefront breadcrumb (plan/14 Phase 0a) — root-first ancestor chain, read from the existing `category_closure` transitive-closure table (excludes the category itself). */
  getAncestors(id: bigint): Promise<CategoryInfo[]>;
  update(id: bigint, input: UpdateCategoryInput): Promise<CategoryInfo>;
  reparent(id: bigint, newParentId: bigint | null): Promise<CategoryInfo>;
  hasChildren(id: bigint): Promise<boolean>;
  hasProducts(id: bigint): Promise<boolean>;
  softDelete(id: bigint): Promise<void>;
}

/** Persistence port for a product's category assignments. */
export interface ProductCategoryRepository {
  /** Replaces the full assigned set in one transaction (delete-all-then-insert). */
  setForProduct(productId: bigint, categoryIds: bigint[]): Promise<void>;
  /** The assigned categories' own publicIds, in position order — the only shape external callers need. */
  listCategoryPublicIdsForProduct(productId: bigint): Promise<string[]>;
}

export interface MediaAssetInfo {
  id: bigint;
  publicId: string;
  storageKey: string;
  mimeType: string;
  kind: MediaKind;
}

export interface CreateMediaAssetInput {
  storageKey: string;
  mimeType: string;
  bytes: bigint;
  width?: number | null;
  height?: number | null;
  kind: MediaKind;
}

/** Persistence port for the media registry (plan/13 Phase J) — rows here point at bytes that live in MinIO/S3, never in this DB. */
export interface MediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAssetInfo>;
  findByPublicId(publicId: string): Promise<MediaAssetInfo | null>;
}

export interface ProductMediaInfo {
  /** ProductMedia has no publicId column (plan/01 §5) — addressed by this internal id externally, same precedent as attribute-sets/groups. */
  id: bigint;
  productId: bigint;
  role: ProductMediaRole;
  position: number;
  altOverride: string | null;
  assetStorageKey: string;
  assetAltDefault: string | null;
}

export interface AttachProductMediaInput {
  productId: bigint;
  assetId: bigint;
  role?: ProductMediaRole;
}

/** Persistence port for a product's attached media (plan/13 Phase J). */
export interface ProductMediaRepository {
  /** Appends at the end of the product's existing gallery (position = current max + 1). */
  attach(input: AttachProductMediaInput): Promise<ProductMediaInfo>;
  listForProduct(productId: bigint): Promise<ProductMediaInfo[]>;
  findById(id: bigint): Promise<ProductMediaInfo | null>;
  detach(id: bigint): Promise<void>;
  /** Admin grid thumbnail — the product's designated THUMBNAIL image if one is set, else its lowest-position GALLERY image, batched for a page of products. Keyed by `productId.toString()`. */
  listThumbnailStorageKeysForProducts(productIds: bigint[]): Promise<Map<string, string>>;
  /** Marks one media row as the product's single THUMBNAIL ("main image"), demoting any other row on the same product currently holding that role back to GALLERY — exactly one thumbnail at a time. */
  setThumbnail(productId: bigint, productMediaId: bigint): Promise<void>;
}

/** Port over the MinIO/S3-backed object store (plan/13 Phase J) — lets use-cases stay unit-testable without a real bucket. */
export interface MediaStorage {
  presignPutUrl(key: string, contentType: string): Promise<string>;
  presignGetUrl(key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export interface BrandInfo {
  id: bigint;
  publicId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface CreateBrandInput {
  slug: string;
  name: string;
  description?: string | null;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string | null;
}

/** Per-variant stock check for the storefront PDP (plan/14 Phase 0c) — catalog's own copy of the same read search/domain/repositories.ts's StockAvailabilityLookup does, per the established per-module lookup pattern, just keyed by variant instead of product (no join needed, the PDP already has the variant id in hand). */
export interface VariantStockLookup {
  isInStock(variantId: bigint): Promise<boolean>;
}

/** Persistence port for the storefront brand entity (plan/14 Phase 0b) — same shape/discipline as CategoryRepository, minus the tree (brands are flat). */
export interface BrandRepository {
  create(input: CreateBrandInput): Promise<BrandInfo>;
  findById(id: bigint): Promise<BrandInfo | null>;
  findByPublicId(publicId: string): Promise<BrandInfo | null>;
  findBySlug(slug: string): Promise<BrandInfo | null>;
  list(): Promise<BrandInfo[]>;
  update(id: bigint, input: UpdateBrandInput): Promise<BrandInfo>;
  hasProducts(id: bigint): Promise<boolean>;
  softDelete(id: bigint): Promise<void>;
}
