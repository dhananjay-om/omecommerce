import type { ProductType, ProductStatus, ProductVisibility, ScopeType, AttributeDataType, AttributeInputType } from '@prisma/client';

export interface CreateProductCommand {
  type: ProductType;
  sku: string;
  attributeSetId: string; // publicId or numeric string from the API boundary
  status?: ProductStatus;
  visibility?: ProductVisibility;
  nameDefault?: string | null;
}

export interface ProductView {
  publicId: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
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

export interface ProductForStoreViewQuery {
  productPublicId: string;
  storeViewId: string;
}

export interface ProductForStoreView extends ProductView {
  storeViewId: string;
  currency: string;
  attributes: Record<string, unknown>;
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
