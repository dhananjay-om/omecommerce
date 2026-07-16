export type ProductType = 'SIMPLE' | 'CONFIGURABLE' | 'BUNDLE' | 'DIGITAL' | 'VIRTUAL';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
export type ProductVisibility = 'BOTH' | 'CATALOG' | 'SEARCH' | 'NOT_VISIBLE';

export interface ProductListItem {
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: string;
}

export interface ProductList {
  total: number;
  page: number;
  pageSize: number;
  products: ProductListItem[];
}

export interface Variant {
  publicId: string;
  sku: string;
  status: string;
  position: number;
}

export interface ProductDetail {
  publicId: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
  attributeSetId: string;
  variants: Variant[];
  attributes: Record<string, unknown>;
}

export interface AttributeSet {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
}
