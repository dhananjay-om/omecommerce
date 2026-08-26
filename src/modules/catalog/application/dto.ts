import type {
  ProductType,
  ProductStatus,
  ProductVisibility,
  ScopeType,
  AttributeDataType,
  AttributeInputType,
  CategoryType,
  CategorySortMode,
  MediaKind,
  ProductMediaRole,
} from '@prisma/client';

export interface CreateProductCommand {
  type: ProductType;
  sku: string;
  attributeSetId: string; // publicId or numeric string from the API boundary
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
  weight?: string | null;
  /** Tax class's internal id, as a string (same "publicId or numeric string"
   *  convention as attributeSetId above). */
  taxClassId?: string | null;
  hsnCode?: string | null;
  tags?: string[];
}

export interface UpdateProductCommand {
  publicId: string;
  nameDefault?: string | null;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  weight?: string | null;
  attributeSetId?: string;
  /** Brand's publicId; `null` clears it (plan/14 Phase 0b). */
  brandId?: string | null;
  /** Tax class's internal id, as a string; `null` clears it (same undefined-vs-null pairing as brandId). */
  taxClassId?: string | null;
  hsnCode?: string | null;
  /** `undefined` leaves tags untouched; `[]` clears them (see UpdateProductInput.tags's own comment). */
  tags?: string[];
}

export interface ProductView {
  publicId: string;
  sku: string;
  /** Storefront canonical URL is /{slug}.html — auto-generated once at creation, never edited afterward (see Product.slug's schema doc comment). */
  slug: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
  weight: string | null;
  taxClassId: string | null;
  hsnCode: string | null;
  tags: string[];
}

export interface AssignAttributeValueCommand {
  productPublicId: string;
  attributeCode: string;
  scope: ScopeType;
  websiteId?: string | null;
  storeId?: string | null;
  storeViewId?: string | null;
  value?: unknown;
}

export interface AssignAttributeValueItem {
  attributeCode: string;
  scope?: ScopeType;
  websiteId?: string | null;
  storeId?: string | null;
  storeViewId?: string | null;
  value?: unknown;
}

export interface AssignAttributeValuesCommand {
  productPublicId: string;
  values: AssignAttributeValueItem[];
}

export interface ProductForStoreViewQuery {
  productPublicId: string;
  storeViewId: string;
}

export interface ProductForStoreView extends ProductView {
  storeViewId: string;
  currency: string;
  /** Website.pricesIncludeTax — when true, `price` below (and every variant's
   *  price) is the final, tax-inclusive price the customer pays; GST is
   *  backed out of it at checkout rather than added on top. */
  pricesIncludeTax: boolean;
  attributes: Record<string, unknown>;
}

export interface StoreProductVariantView {
  publicId: string;
  sku: string;
  status: string;
  position: number;
  price: string | null;
  /** "MRP" / compare-at price — null when unset, or when the resolved price came from
   *  a qty tier (see pricing's ResolvedPrice.mrp doc comment). Drives the PDP's
   *  strikethrough + "X% off" display when mrp > price. */
  mrp: string | null;
  inStock: boolean;
  /** Which axis-attribute option this variant represents (Size=M, Color=Red, ...) — powers the
   * storefront's variant picker. Empty for a SIMPLE/DIGITAL/VIRTUAL product's single implicit variant. */
  axisValues: VariantAxisValueView[];
}

/**
 * The full storefront PDP response (plan/14 Phase 0c) — composes
 * ProductForStoreView (cached attributes) with price/stock/media/variants/
 * categories/brand, none of which share that cache's 300s TTL since they
 * change on a different cadence.
 */
export interface StoreProductDetailView extends ProductForStoreView {
  /** The first-by-position variant's price — a representative default for multi-variant products, not a price range. */
  price: string | null;
  /** The first-by-position variant's MRP — same "representative default" caveat as `price` above. */
  mrp: string | null;
  inStock: boolean;
  media: ProductMediaView[];
  variants: StoreProductVariantView[];
  categoryIds: string[];
  brandSlug: string | null;
}

export interface ListProductsQuery {
  page?: number;
  pageSize?: number;
  status?: ProductStatus;
  type?: ProductType;
  attributeSetId?: string;
  search?: string;
  sortBy?: 'sku' | 'nameDefault' | 'createdAt' | 'status';
  sortDir?: 'asc' | 'desc';
}

export interface ProductListItemView {
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: string;
  quantity: number;
  salableQuantity: number;
  thumbnailUrl: string | null;
  hasTaxClass: boolean;
}

export interface ProductListView {
  total: number;
  page: number;
  pageSize: number;
  products: ProductListItemView[];
}

export interface ProductDetailView extends ProductView {
  attributeSetId: string;
  variants: VariantView[];
  attributes: Record<string, unknown>;
  categoryIds: string[];
  media: ProductMediaView[];
}

export interface CreateAttributeSetCommand {
  code: string;
  name: string;
  isDefault?: boolean;
}

export interface AttributeSetView {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export interface AttributeOptionView {
  id: string;
  value: string;
  label: string;
  swatch: string | null;
  sortOrder: number;
}

export interface AttributeSetAttributeView {
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
  isRequired: boolean;
  isVariantForming: boolean;
  sortOrder: number;
  options: AttributeOptionView[];
}

export interface AttributeSetGroupDetailView {
  id: string;
  name: string;
  sortOrder: number;
  attributes: AttributeSetAttributeView[];
}

export interface AttributeSetDetailView extends AttributeSetView {
  groups: AttributeSetGroupDetailView[];
}

export interface CreateAttributeSetGroupCommand {
  attributeSetId: string;
  name: string;
  sortOrder?: number;
}

export interface AttributeSetGroupView {
  id: string;
  attributeSetId: string;
  name: string;
  sortOrder: number;
}

export interface CreateAttributeOptionCommand {
  value: string;
  label: string;
  swatch?: string | null;
  sortOrder?: number;
}

export interface CreateAttributeCommand {
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
  options?: CreateAttributeOptionCommand[];
}

export interface AttributeView {
  id: string;
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isComparable: boolean;
  isSortable: boolean;
  isVisiblePdp: boolean;
  isVisiblePlp: boolean;
  usedInSearch: boolean;
  usedInLayeredNav: boolean;
  isVariantForming: boolean;
}

export interface UpdateAttributeCommand {
  label?: string;
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
}

export interface AssignAttributeToGroupCommand {
  attributeSetId: string;
  groupId: string;
  attributeCode: string;
  sortOrder?: number;
}

/** One row of a bulk product import job (plan/04 §4). `attributes` is code -> value, always assigned at GLOBAL scope. */
export interface BulkImportProductRow {
  sku: string;
  type: ProductType;
  attributeSetId: string;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
  attributes?: Record<string, unknown>;
}

export interface BulkImportRowError {
  row: number;
  sku: string;
  message: string;
}

export interface BulkImportResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BulkImportRowError[];
}

/**
 * One row of a Magento-style "Add/Update" product CSV import — create a
 * NEW product if `sku` doesn't exist yet, otherwise patch the existing one
 * (matching UpdateProduct's own patch semantics: only fields present here
 * are touched). Scoped to non-configurable product types — a CONFIGURABLE/
 * BUNDLE product needs variant-axis/component data this flat row shape
 * can't express; that stays a form-only operation.
 *
 * `attributeSetCode`/`categorySlugs` are CSV-friendly identifiers (never
 * raw internal ids) — resolved to the real ids inside the worker. `price`/
 * `mrp`/`qty` are optional per-row overlays onto the job-level `priceListCode`/
 * `warehouseCode` (see BulkUpsertProductsCommand) — a row can skip them
 * entirely to leave pricing/stock untouched.
 */
export interface BulkProductImportRow {
  sku: string;
  /** Required only when creating (no existing product with this SKU). */
  type?: ProductType;
  /** AttributeSet.code — required only when creating; optional on update (reassigns the set if given). */
  attributeSetCode?: string;
  nameDefault?: string | null;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  weight?: string | null;
  price?: string | null;
  mrp?: string | null;
  qty?: number | null;
  /** Category.slug values. `undefined` = don't touch. `[]` = clear all assigned categories
   *  (the CSV column was present but the cell was empty for this row). */
  categorySlugs?: string[];
  /** Attribute code -> raw CSV cell text, parsed per the attribute's own dataType
   *  (see bulk-import.worker.ts's parseAttributeCell). GLOBAL scope only. */
  attributes?: Record<string, string>;
}

export interface BulkProductImportRowError {
  row: number;
  sku: string;
  message: string;
}

export interface BulkProductImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: BulkProductImportRowError[];
}

export interface VariantAxisValueView {
  attributeCode: string;
  attributeLabel: string;
  optionLabel: string;
}

export interface VariantView {
  publicId: string;
  sku: string;
  status: string;
  position: number;
  axisValues: VariantAxisValueView[];
}

export interface GenerateVariantsAxisInput {
  attributeCode: string;
  optionIds: string[];
}

export interface GenerateVariantsCommand {
  productPublicId: string;
  axes: GenerateVariantsAxisInput[];
}

export interface GenerateVariantsResult {
  created: number;
  skipped: number;
  variants: VariantView[];
}

export interface UpdateVariantCommand {
  productPublicId: string;
  variantPublicId: string;
  sku?: string;
  status?: string;
}

export interface CreateCategoryCommand {
  /** Parent category's publicId; omit/null for a root category. */
  parentId?: string | null;
  nameDefault?: string | null;
  type?: CategoryType;
  sortMode?: CategorySortMode;
  position?: number;
  description?: string | null;
  imageMediaKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  includeInMenu?: boolean;
}

export interface UpdateCategoryCommand {
  publicId: string;
  nameDefault?: string | null;
  sortMode?: CategorySortMode;
  position?: number;
  description?: string | null;
  imageMediaKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  includeInMenu?: boolean;
}

export interface ReparentCategoryCommand {
  publicId: string;
  /** New parent's publicId; null moves the category to root. */
  newParentId: string | null;
}

export interface CategoryView {
  publicId: string;
  parentId: string | null;
  slug: string;
  type: CategoryType;
  sortMode: CategorySortMode;
  position: number;
  nameDefault: string | null;
  description: string | null;
  imageMediaKey: string | null;
  /** Presigned GET URL for imageMediaKey, resolved live on every read (15-minute
   *  expiry, same as every other presigned URL in this codebase) — null when no image is set. */
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  includeInMenu: boolean;
  createdAt: string;
}

export interface RequestCategoryImageUploadCommand {
  publicId: string;
  filename: string;
  mimeType: string;
}

export interface CategoryImageUploadUrl {
  uploadUrl: string;
  imageMediaKey: string;
}

export interface CategoryBreadcrumbView {
  category: CategoryView;
  breadcrumb: CategoryView[];
}

export interface SetProductCategoriesCommand {
  productPublicId: string;
  /** Category publicIds — replaces the product's full assigned set. */
  categoryIds: string[];
}

export interface RequestMediaUploadCommand {
  filename: string;
  mimeType: string;
}

export interface RequestMediaUploadResult {
  uploadUrl: string;
  storageKey: string;
}

export interface CreateMediaAssetCommand {
  storageKey: string;
  mimeType: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
}

export interface MediaAssetView {
  publicId: string;
  mimeType: string;
  kind: MediaKind;
}

export interface AttachProductMediaCommand {
  productPublicId: string;
  mediaPublicId: string;
  role?: ProductMediaRole;
}

export interface ProductMediaView {
  productMediaId: string;
  url: string;
  role: ProductMediaRole;
  position: number;
  altText: string | null;
}

export interface ProductReviewView {
  publicId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  /** Resolved presigned GET URLs (900s), same as ProductMediaView.url — never
   *  the raw storage keys. Re-resolved fresh on every read. */
  images: string[];
  isApproved: boolean;
  createdAt: string;
}

/** Cross-product admin queue row — the same view, plus which product it
 *  belongs to (every per-product read already has that from the URL). */
export interface AdminReviewListItemView extends ProductReviewView {
  productPublicId: string;
  productName: string;
}

export interface PaginatedAdminReviewsView {
  total: number;
  page: number;
  pageSize: number;
  reviews: AdminReviewListItemView[];
}

export interface SubmitProductReviewCommand {
  productPublicId: string;
  customerPublicId: string;
  rating: number;
  title: string | null;
  body: string;
  /** Storage keys from a prior POST /reviews/uploads round-trip — never a
   *  raw file, that upload always goes direct-to-storage. */
  imageKeys: string[];
}

export interface ModerateProductReviewCommand {
  productPublicId: string;
  reviewPublicId: string;
  isApproved: boolean;
}

export interface RatingBreakdownView {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ProductReviewListView {
  total: number;
  page: number;
  pageSize: number;
  averageRating: number | null;
  ratingBreakdown: RatingBreakdownView;
  reviews: ProductReviewView[];
}

export interface DetachProductMediaCommand {
  productPublicId: string;
  productMediaId: string;
}

export interface UpdateProductMediaAltTextCommand {
  productPublicId: string;
  productMediaId: string;
  /** `null` clears the override, reverting to the asset's own default alt text. */
  altText: string | null;
}

export interface SetProductThumbnailCommand {
  productPublicId: string;
  productMediaId: string;
}

export interface CreateBrandCommand {
  name: string;
  description?: string | null;
}

export interface UpdateBrandCommand {
  publicId: string;
  name?: string;
  description?: string | null;
}

export interface BrandView {
  publicId: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}
