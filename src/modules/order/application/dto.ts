import type { OrderStatus, FinancialStatus, FulfillmentStatus } from '@prisma/client';

export interface CreateCartCommand {
  storeViewId: string;
  customerPublicId?: string | null;
  customerGroupCode?: string | null;
}

export interface CartLineDto {
  id: string;
  variantId: string;
  qty: number;
  /** Denormalized display fields (plan/14 Phase 5a) — resolved fresh on every
   * read, never stored on the cart line itself, same reasoning as PDP's
   * price/stock (see GetStoreProductDetail's doc comment): they change on a
   * different cadence than the cart line's own {id, variantId, qty}. */
  sku: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
  /** `price * qty`, or null when price is null (no price configured for this variant). */
  lineTotal: string | null;
}

export interface CartView {
  publicId: string;
  currency: string;
  status: string;
  lines: CartLineDto[];
  /** Sum of every line's `lineTotal` that resolved to a real price; null if the cart has no priced lines yet. */
  subtotal: string | null;
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
  /** req.ip, captured at the HTTP layer — plan/15 Phase 0a, shown on the admin Order Information section. */
  customerIp?: string | null;
}

export interface OrderLineViewDto {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  discountAmount: string;
  rowTotal: string;
  fulfilledQty: number;
  refundedQty: number;
}

export interface OrderAddressDto {
  type: string;
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface PaymentTransactionDto {
  method: string;
  gateway: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  gatewayRef: string | null;
  createdAt: string;
}

export interface FulfillmentLineDto {
  sku: string;
  qty: number;
}

export interface FulfillmentDto {
  publicId: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  carrierTrackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  currentStatus: string | null;
  shippingNotes: string | null;
  /** Whether a packing slip PDF has been rendered — the raw storage key never leaves the backend (see MediaUrlResolver's presign-not-proxy convention). */
  hasPackingSlip: boolean;
  shippedAt: string | null;
  createdAt: string;
  lines: FulfillmentLineDto[];
}

export interface OrderReturnLineDto {
  sku: string;
  qty: number;
  restock: boolean;
}

export interface OrderReturnDto {
  publicId: string;
  reason: string;
  status: string;
  createdAt: string;
  lines: OrderReturnLineDto[];
}

export interface OrderNoteDto {
  id: string;
  type: string;
  body: string;
  createdAt: string;
}

export interface OrderInvoiceLineDto {
  sku: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  rowTotal: string;
}

export interface OrderInvoiceDto {
  publicId: string;
  invoiceNumber: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  createdAt: string;
  lines: OrderInvoiceLineDto[];
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
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  shippingMethodCode: string | null;
  customerIp: string | null;
  placedAt: string;
  closedAt: string | null;
  lines: OrderLineViewDto[];
  addresses: OrderAddressDto[];
  payments: PaymentTransactionDto[];
  fulfillments: FulfillmentDto[];
  returns: OrderReturnDto[];
  notes: OrderNoteDto[];
  invoices: OrderInvoiceDto[];
}

export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'grandTotal' | 'customerName';
  sortDir?: 'asc' | 'desc';
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
  email?: string;
  orderId?: string;
  customerName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderListItemDto {
  publicId: string;
  orderNumber: string;
  email: string;
  customerName: string;
  paymentMethod: string | null;
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
  /** plan/15 Phase 2 additions — a carrier deep-link, ETA, and free-text shipping notes, stored on the fulfillment's 1:1 shipment_tracking row. */
  carrierTrackingUrl?: string;
  estimatedDeliveryAt?: string;
  shippingNotes?: string;
}

export interface RefundOrderCommand {
  orderPublicId: string;
  lines: Array<{ sku: string; qty: number }>;
  restock?: boolean;
  /** plan/15 Phase 0e — where the refunded amount goes. Defaults to the pre-existing behavior (simulated gateway refund) so nothing breaks for existing callers. */
  refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET';
}

export interface CancelOrderCommand {
  orderPublicId: string;
  reason?: string;
  refundTo?: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET';
}

export interface ShippingMethodViewDto {
  code: string;
  name: string;
  flatRate: string;
  currency: string;
}

export interface OrderHistoryDto {
  id: string;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  actorType: string;
  actorName: string | null;
  createdAt: string;
}

export interface AddOrderNoteCommand {
  orderPublicId: string;
  type: 'INTERNAL' | 'CUSTOMER';
  body: string;
  createdBy?: string | null;
}

export interface CreateInvoiceCommand {
  orderPublicId: string;
  /** Omit to invoice every line's full remaining (not-yet-invoiced) qty — supports partial invoicing across multiple calls, same shape as FulfillOrderCommand's `lines`. */
  lines?: Array<{ sku: string; qty: number }>;
  createdBy?: string | null;
}

export interface OrderEmailLogDto {
  id: string;
  emailType: string;
  toEmail: string;
  subject: string;
  status: string;
  createdAt: string;
}

export interface SendOrderEmailCommand {
  orderPublicId: string;
  type: 'CONFIRMATION' | 'INVOICE' | 'SHIPMENT' | 'CANCELLATION' | 'REFUND' | 'CUSTOM';
  /** Required (and only used) when type is CUSTOM. */
  subject?: string;
  body?: string;
  sentBy?: string | null;
}
