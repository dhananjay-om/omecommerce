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
