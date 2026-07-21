import type {
  CartStatus,
  AddressType,
  PaymentTxnType,
  PaymentTxnStatus,
  ShipmentStatus,
  FinancialStatus,
  OrderStatus,
  FulfillmentStatus,
  OrderHistoryActorType,
  OrderNoteType,
  InvoiceStatus,
} from '@prisma/client';

// --- Cross-module read-only lookups (each module resolves its own dependencies) ---

export interface VariantLookup {
  byPublicId(publicId: string): Promise<{ id: bigint; sku: string; nameDefault: string | null; productId: bigint } | null>;
  byId(id: bigint): Promise<{ sku: string; nameDefault: string | null; productId: bigint } | null>;
}

/** The lowest-position media asset's storage KEY for a product (plan/14 Phase 5a) — own copy of the same lookup search's IndexProduct uses; not a URL, see MediaUrlResolver's doc comment for why. */
export interface CartProductMediaLookup {
  primaryImageKey(productId: bigint): Promise<string | null>;
}

/** Order owns its own copy of this lookup, same as every other module (Pricing,
 * Inventory each have their own) — cross-module reads never import another
 * module's domain/repositories.ts directly. */
export interface CustomerGroupLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
}

/** Resolves a logged-in customer's publicId to their internal id, so a cart (and the order it becomes) can carry it (own trivial copy, per-module convention). */
export interface CustomerLookup {
  findIdByPublicId(customerPublicId: string): Promise<bigint | null>;
  /** Reverse direction — plan/15 Phase 0e needs it to credit a wallet (keyed by publicId) from an order's internal customerId. */
  findPublicIdById(customerId: bigint): Promise<string | null>;
}

/** plan/15 Phase 0b — resolves the acting admin (from the JWT's adminUserPublicId claim) to an id + display name for order_status_history/order_note's actor columns. Own copy, per-module convention — AdminUser has no `name` column, so email is the display name. */
export interface AdminUserLookup {
  findByPublicId(publicId: string): Promise<{ id: bigint; email: string } | null>;
}

export interface TaxClassInfo {
  code: string;
  rateMinor: bigint;
}

/** Resolves a variant's applicable tax class via product.tax_class_id. */
export interface TaxClassLookup {
  byVariantId(variantId: bigint): Promise<TaxClassInfo | null>;
}

/** Picks which warehouse a store's orders ship from (plan/07 §4 sourcing). */
export interface WarehouseResolver {
  resolveForStore(storeId: bigint): Promise<{ id: bigint; code: string } | null>;
  /** The specific warehouse a given order line was fulfilled from, if any. */
  resolveForOrderLine(orderLineId: bigint): Promise<{ id: bigint; code: string } | null>;
}

export interface TaxClassRepository {
  create(input: { code: string; name: string; rate: string }): Promise<{ publicId: string; code: string }>;
  findByCode(code: string): Promise<{ id: bigint; code: string } | null>;
}

export interface ShippingMethodInfo {
  code: string;
  name: string;
  flatRate: string;
  currency: string;
}

export interface ShippingMethodRepository {
  create(input: { code: string; name: string; flatRate: string; currency: string }): Promise<{ publicId: string; code: string }>;
  findByCode(code: string): Promise<{ id: bigint; code: string } | null>;
  /** Storefront checkout needs to show real options, not a blind code (plan/14 Phase 7a). */
  list(currency: string): Promise<ShippingMethodInfo[]>;
}

// --- Cart ---

export interface CartLineView {
  id: bigint;
  /** Internal id — used throughout checkout (price/tax/stock resolution all key off this). Never serialized directly; see `variantPublicId` for the external-facing id. */
  variantId: bigint;
  /** The variant's own publicId (plan/14 Phase 0d) — what a storefront cart response actually needs, since a client addresses variants/products by publicId everywhere else. */
  variantPublicId: string;
  qty: number;
}

export interface CartView {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  storeViewId: bigint;
  currency: string;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  status: CartStatus;
  lines: CartLineView[];
}

export interface CreateCartInput {
  websiteId: bigint;
  storeViewId: bigint;
  currency: string;
  customerId?: bigint | null;
  customerGroupId?: bigint | null;
}

export interface CartRepository {
  create(input: CreateCartInput): Promise<CartView>;
  findByPublicId(publicId: string): Promise<CartView | null>;
  /** Upserts the line's qty (add if new, overwrite if exists). qty<=0 removes the line. */
  upsertLine(cartId: bigint, variantId: bigint, qty: number): Promise<void>;
  /** Guarded ACTIVE -> CONVERTED transition; throws if the cart isn't ACTIVE. */
  claimForCheckout(cartId: bigint): Promise<void>;
}

// --- Order ---

export interface OrderLineInput {
  variantId: bigint;
  sku: string;
  name: string;
  qty: number;
  unitPriceMinor: bigint;
  taxAmountMinor: bigint;
  rowTotalMinor: bigint;
  taxClassCode: string | null;
}

export interface OrderAddressInput {
  type: AddressType;
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

export interface OrderTaxLineInput {
  taxClassCode: string;
  rateMinor: bigint;
  amountMinor: bigint;
}

export interface CreateOrderInput {
  cartId: bigint | null;
  websiteId: bigint;
  storeId: bigint;
  storeViewId: bigint;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  email: string;
  currency: string;
  customerIp?: string | null;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  shippingTotalMinor: bigint;
  grandTotalMinor: bigint;
  shippingMethodCode: string;
  lines: OrderLineInput[];
  addresses: OrderAddressInput[];
  taxLines: OrderTaxLineInput[];
}

export interface OrderLineView {
  id: bigint;
  variantId: bigint;
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  discountAmount: string;
  rowTotal: string;
  fulfilledQty: number;
  refundedQty: number;
  version: number;
}

export interface OrderAddressView {
  type: AddressType;
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

export interface PaymentTransactionView {
  id: bigint;
  method: string;
  gateway: string;
  type: PaymentTxnType;
  amount: string;
  currency: string;
  status: PaymentTxnStatus;
  gatewayRef: string | null;
  createdAt: Date;
}

export interface FulfillmentLineView {
  orderLineId: bigint;
  qty: number;
}

export interface FulfillmentView {
  publicId: string;
  status: ShipmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  createdAt: Date;
  lines: FulfillmentLineView[];
}

export interface OrderReturnLineView {
  orderLineId: bigint;
  qty: number;
  restock: boolean;
}

export interface OrderReturnView {
  publicId: string;
  reason: string;
  status: string;
  createdAt: Date;
  lines: OrderReturnLineView[];
}

export interface OrderNoteView {
  id: bigint;
  type: OrderNoteType;
  body: string;
  createdAt: Date;
}

/** plan/15 Phase 0b — one row of the order timeline. */
export interface OrderHistoryView {
  id: bigint;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  actorType: OrderHistoryActorType;
  actorName: string | null;
  createdAt: Date;
}

export interface RecordOrderHistoryInput {
  orderId: bigint;
  eventType: string;
  fromValue?: string | null;
  toValue?: string | null;
  message?: string | null;
  actorType: OrderHistoryActorType;
  actorId?: bigint | null;
  actorName?: string | null;
}

export interface AddOrderNoteInput {
  orderId: bigint;
  type: OrderNoteType;
  body: string;
  createdBy?: bigint | null;
}

/** plan/15 Phase 1 — the invoiced subset of an order_line, snapshotted at invoice-creation time. */
export interface OrderInvoiceLineView {
  orderLineId: bigint;
  qty: number;
  unitPrice: string;
  taxAmount: string;
  rowTotal: string;
}

export interface OrderInvoiceView {
  id: bigint;
  publicId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  pdfStorageKey: string | null;
  createdAt: Date;
  lines: OrderInvoiceLineView[];
}

export interface CreateInvoiceInput {
  orderId: bigint;
  invoiceNumber: bigint;
  subtotalMinor: bigint;
  discountTotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  createdBy?: bigint | null;
  lines: Array<{ orderLineId: bigint; qty: number; unitPriceMinor: bigint; taxAmountMinor: bigint; rowTotalMinor: bigint }>;
}

export interface OrderView {
  id: bigint;
  publicId: string;
  orderNumber: string;
  websiteId: bigint;
  storeId: bigint;
  customerId: bigint | null;
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
  placedAt: Date;
  closedAt: Date | null;
  lines: OrderLineView[];
  addresses: OrderAddressView[];
  payments: PaymentTransactionView[];
  fulfillments: FulfillmentView[];
  returns: OrderReturnView[];
  notes: OrderNoteView[];
  invoices: OrderInvoiceView[];
}

export interface OrderListItem {
  publicId: string;
  orderNumber: string;
  email: string;
  /** Billing address's snapshotted name — an order has no separate "customer name" column; this is the point-in-time name at purchase, same snapshot philosophy as every other order field (plan/15 Phase 0c). Falls back to email if, unexpectedly, no billing address exists. */
  customerName: string;
  /** Most recent payment transaction's method (e.g. "test_card"), or null if none recorded yet. */
  paymentMethod: string | null;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  grandTotal: string;
  createdAt: Date;
}

export interface ListOrdersFilter {
  page: number;
  pageSize: number;
  sortBy?: 'createdAt' | 'grandTotal' | 'customerName';
  sortDir?: 'asc' | 'desc';
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
  email?: string;
  /** Matches order_number (exact) or the publicId (exact/prefix) — accepts whatever an admin pastes from the grid or a support ticket. */
  orderId?: string;
  /** ILIKE against the billing address name (see OrderListItem.customerName). */
  customerName?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OrderListResult {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderListItem[];
}

export interface OrderRepository {
  nextOrderNumber(websiteId: bigint): Promise<bigint>;
  create(input: CreateOrderInput, orderNumber: bigint): Promise<OrderView>;
  findByPublicId(publicId: string): Promise<OrderView | null>;
  list(filter: ListOrdersFilter): Promise<OrderListResult>;
  setFinancialStatus(orderId: bigint, status: FinancialStatus): Promise<void>;
  setOrderStatus(orderId: bigint, status: OrderStatus): Promise<void>;
  setFulfillmentStatus(orderId: bigint, status: FulfillmentStatus): Promise<void>;
  setClosedAt(orderId: bigint, closedAt: Date): Promise<void>;
  recordPayment(input: {
    orderId: bigint;
    method: string;
    gateway: string;
    type: PaymentTxnType;
    amountMinor: bigint;
    currency: string;
    status: PaymentTxnStatus;
    gatewayRef: string | null;
    raw?: unknown;
  }): Promise<void>;
  /** Guarded: throws if fulfilledQty+qty would exceed the line's qty (race-safe). */
  incrementFulfilledQty(orderLineId: bigint, qty: number): Promise<void>;
  /** Guarded: throws if refundedQty+qty would exceed the line's qty (race-safe). */
  incrementRefundedQty(orderLineId: bigint, qty: number): Promise<void>;
  createFulfillment(input: {
    orderId: bigint;
    warehouseId: bigint;
    status: ShipmentStatus;
    trackingNumber?: string | null;
    carrier?: string | null;
    lines: Array<{ orderLineId: bigint; qty: number }>;
  }): Promise<{ id: bigint; publicId: string }>;
  /** plan/15 Phase 0b — appends one timeline row; called alongside (not instead of) the existing outbox.write() calls in every mutating usecase. */
  recordHistory(input: RecordOrderHistoryInput): Promise<void>;
  listHistory(orderId: bigint): Promise<OrderHistoryView[]>;
  addNote(input: AddOrderNoteInput): Promise<OrderNoteView>;
  /** plan/15 Phase 1 — race-safe per-website invoice-number sequence (next_invoice_number()), identical mechanics to nextOrderNumber. */
  nextInvoiceNumber(websiteId: bigint): Promise<bigint>;
  createInvoice(input: CreateInvoiceInput): Promise<OrderInvoiceView>;
  setInvoicePdfKey(invoiceId: bigint, key: string): Promise<void>;
}
