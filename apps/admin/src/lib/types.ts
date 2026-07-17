export type ProductType = 'SIMPLE' | 'CONFIGURABLE' | 'BUNDLE' | 'DIGITAL' | 'VIRTUAL';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ProductVisibility = 'BOTH' | 'CATALOG' | 'SEARCH' | 'NOT_VISIBLE';

export interface ProductListItem {
  publicId: string;
  sku: string;
  name: string | null;
  type: ProductType;
  status: ProductStatus;
  createdAt: string;
  quantity: number;
  salableQuantity: number;
  thumbnailUrl: string | null;
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

export type ProductMediaRole = 'GALLERY' | 'THUMBNAIL' | 'SWATCH' | 'VIDEO' | 'DOCUMENT';

export interface ProductMedia {
  productMediaId: string;
  url: string;
  role: ProductMediaRole;
  position: number;
  altText: string | null;
}

export interface ProductDetail {
  publicId: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  visibility: ProductVisibility;
  name: string | null;
  weight: string | null;
  attributeSetId: string;
  variants: Variant[];
  attributes: Record<string, unknown>;
  categoryIds: string[];
  media: ProductMedia[];
}

export type CategoryType = 'MANUAL' | 'DYNAMIC';
export type CategorySortMode = 'POSITION' | 'NAME' | 'PRICE' | 'NEWEST';

export interface Category {
  publicId: string;
  parentId: string | null;
  type: CategoryType;
  sortMode: CategorySortMode;
  position: number;
  nameDefault: string | null;
  createdAt: string;
}

export interface AttributeSet {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
}

export type AttributeDataType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'COLOR'
  | 'SELECT'
  | 'MULTISELECT'
  | 'IMAGE'
  | 'FILE'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'JSON'
  | 'RICHTEXT'
  | 'REF_PRODUCT'
  | 'REF_CATEGORY'
  | 'REF_BRAND'
  | 'REF_CMS'
  | 'REF_COLLECTION'
  | 'REF_CUSTOMER';

export interface AttributeOption {
  /** The AttributeOption row's own id — SELECT attribute values are submitted/read as this id, not `value` below. */
  id: string;
  value: string;
  label: string;
  swatch: string | null;
  sortOrder: number;
}

export interface AttributeSetAttribute {
  code: string;
  label: string;
  dataType: AttributeDataType;
  isRequired: boolean;
  sortOrder: number;
  options: AttributeOption[];
}

export interface AttributeSetGroupDetail {
  id: string;
  name: string;
  sortOrder: number;
  attributes: AttributeSetAttribute[];
}

export interface AttributeSetDetail extends AttributeSet {
  groups: AttributeSetGroupDetail[];
}

export type AttributeInputType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DECIMAL'
  | 'SWITCH'
  | 'DATE'
  | 'DATETIME'
  | 'COLOR_PICKER'
  | 'DROPDOWN'
  | 'MULTISELECT'
  | 'IMAGE_PICKER'
  | 'FILE_UPLOAD'
  | 'RICHTEXT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'JSON_EDITOR'
  | 'REFERENCE';

/** The reusable-attribute library (plan/13 Phase L) — one row per Attribute definition, independent of any set. */
export interface Attribute {
  id: string;
  code: string;
  label: string;
  dataType: AttributeDataType;
  inputType: AttributeInputType;
}

export type WarehouseType = 'PHYSICAL' | 'VIRTUAL' | 'DROPSHIP';

export interface Warehouse {
  publicId: string;
  code: string;
  name: string;
  type: WarehouseType;
}

export interface WarehouseStockItem {
  variantPublicId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
}

export type PriceListType = 'BASE' | 'WHOLESALE' | 'B2B' | 'SPECIAL';

export interface PriceList {
  publicId: string;
  code: string;
  name: string;
  currency: string;
  type: PriceListType;
  priority: number;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type FinancialStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';
export type FulfillmentStatus = 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'RETURNED';

export interface OrderListItem {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  grandTotal: string;
  createdAt: string;
}

export interface OrderList {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderListItem[];
}

export interface OrderLine {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  rowTotal: string;
  fulfilledQty: number;
  refundedQty: number;
}

export interface OrderDetail {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  lines: OrderLine[];
}

export interface CustomerListItem {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerList {
  total: number;
  page: number;
  pageSize: number;
  customers: CustomerListItem[];
}

export interface CustomerAddress {
  publicId: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CustomerDetail {
  publicId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: CustomerAddress[];
}
