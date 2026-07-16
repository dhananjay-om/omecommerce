import type {
  ProductType,
  ProductStatus,
  ProductVisibility,
  ScopeType,
  AttributeDataType,
  AttributeInputType,
  CategoryType,
  CategorySortMode,
} from '@prisma/client';

export interface CreateProductCommand {
  type: ProductType;
  sku: string;
  attributeSetId: string; // publicId or numeric string from the API boundary
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
  weight?: string | null;
}

export interface UpdateProductCommand {
  publicId: string;
  nameDefault?: string | null;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  weight?: string | null;
  attributeSetId?: string;
}

export interface ProductView {
  publicId: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
  weight: string | null;
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
  attributes: Record<string, unknown>;
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

export interface VariantView {
  publicId: string;
  sku: string;
  status: string;
  position: number;
}

export interface CreateCategoryCommand {
  /** Parent category's publicId; omit/null for a root category. */
  parentId?: string | null;
  nameDefault?: string | null;
  type?: CategoryType;
  sortMode?: CategorySortMode;
  position?: number;
}

export interface UpdateCategoryCommand {
  publicId: string;
  nameDefault?: string | null;
  sortMode?: CategorySortMode;
  position?: number;
}

export interface ReparentCategoryCommand {
  publicId: string;
  /** New parent's publicId; null moves the category to root. */
  newParentId: string | null;
}

export interface CategoryView {
  publicId: string;
  parentId: string | null;
  type: CategoryType;
  sortMode: CategorySortMode;
  position: number;
  nameDefault: string | null;
  createdAt: string;
}

export interface SetProductCategoriesCommand {
  productPublicId: string;
  /** Category publicIds — replaces the product's full assigned set. */
  categoryIds: string[];
}
