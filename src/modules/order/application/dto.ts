import type { OrderStatus, FinancialStatus } from '@prisma/client';

export interface CreateCartCommand {
  storeViewId: string;
  customerPublicId?: string | null;
  customerGroupCode?: string | null;
}

export interface CartLineDto {
  id: string;
  variantId: string;
  qty: number;
}

export interface CartView {
  publicId: string;
  currency: string;
  status: string;
  lines: CartLineDto[];
}

export interface AddCartLineCommand {
  cartPublicId: string;
  variantId: string;
  qty: number;
}

export interface RemoveCartLineCommand {
  cartPublicId: string;
  variantId: string;
}

export interface AddressInput {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface CompleteCheckoutCommand {
  cartPublicId: string;
  email: string;
  billingAddress: AddressInput;
  shippingAddress: AddressInput;
  shippingMethodCode: string;
  paymentMethod: string;
  testScenario?: 'approve' | 'decline';
}

export interface OrderLineViewDto {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  rowTotal: string;
  fulfilledQty: number;
  refundedQty: number;
}

export interface OrderViewDto {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  lines: OrderLineViewDto[];
}

export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  email?: string;
}

export interface OrderListItemDto {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  createdAt: string;
}

export interface OrderListDto {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderListItemDto[];
}

export interface FulfillOrderCommand {
  orderPublicId: string;
  lines: Array<{ sku: string; qty: number }>;
  trackingNumber?: string;
  carrier?: string;
}

export interface RefundOrderCommand {
  orderPublicId: string;
  lines: Array<{ sku: string; qty: number }>;
  restock?: boolean;
}

export interface CancelOrderCommand {
  orderPublicId: string;
}
