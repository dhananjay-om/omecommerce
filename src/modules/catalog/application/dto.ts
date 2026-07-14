import type { ProductType, ProductStatus, ProductVisibility, ScopeType } from '@prisma/client';

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
