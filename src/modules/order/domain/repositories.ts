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
  EmailLogStatus,
  OrderEmailType,
  TenderType,
  PaymentMethodType,
} from '@prisma/client';
import type { WalletSettings } from './wallet-rules.js';

// --- Cross-module read-only lookups (each module resolves its own dependencies) ---

export interface VariantLookup {
  byPublicId(
    publicId: string,
  ): Promise<{ id: bigint; sku: string; nameDefault: string | null; productId: bigint } | null>;
  /** `status` added for plan/15 Phase 11 (Reorder) — must skip variants that no longer exist or are INACTIVE; every existing caller ignores the extra field.
   *  `hsnCode` added for the GST module — snapshotted onto OrderLine.hsnCode at order-creation time; every existing caller ignores it too. */
  byId(
    id: bigint,
  ): Promise<{
    sku: string;
    nameDefault: string | null;
    productId: bigint;
    status: 'ACTIVE' | 'INACTIVE';
    hsnCode: string | null;
  } | null>;
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
  /** plan/15 Phase 6 — the fallback tier of resolveCustomerGroupId()'s precedence chain (company -> customer's own group -> default group -> null), backed by pricing.prisma's `uq_one_default_customer_group` partial unique index, so at most one row can ever match. */
  findDefault(): Promise<{ id: bigint } | null>;
  /** plan/15 Phase 6 — EnrichCartView's "your company pricing is applied" cart-summary line needs the resolved group's display name. */
  byId(id: bigint): Promise<{ name: string } | null>;
}

/** Resolves a logged-in customer's publicId to their internal id, so a cart (and the order it becomes) can carry it (own trivial copy, per-module convention). */
export interface CustomerLookup {
  findIdByPublicId(customerPublicId: string): Promise<bigint | null>;
  /** Reverse direction — plan/15 Phase 0e needs it to credit a wallet (keyed by publicId) from an order's internal customerId. */
  findPublicIdById(customerId: bigint): Promise<string | null>;
  /** plan/15 Phase 6 — the middle tier of resolveCustomerGroupId()'s precedence chain: a registered customer's own (pre-B2B) group assignment, used when they have no active company membership. */
  findGroupIdByCustomerId(customerId: bigint): Promise<bigint | null>;
}

/**
 * plan/15 Phase 6 — read-only cross-module lookup into the Company module's
 * tables (own copy, per-module convention — not company module's own
 * repository). Only ever returns an ACTIVE company's membership: a
 * PENDING/SUSPENDED/REJECTED company must not grant its pricing/tax terms,
 * so those simply resolve as "no membership" here rather than the caller
 * having to re-check status itself.
 */
export interface CompanyMembershipLookup {
  /** creditAccountId is null when the company has no Net-X terms configured — CREDIT_TERMS simply isn't an available tender for that customer's cart (plan/15 Phase 7). */
  findActiveByCustomerId(
    customerId: bigint,
  ): Promise<{
    companyId: bigint;
    customerGroupId: bigint | null;
    taxExempt: boolean;
    creditAccountId: bigint | null;
  } | null>;
}

/** plan/15 Phase 6 — admin/storefront order-detail "company" badge/link (own copy, not company module's own repository). */
export interface CompanyLookup {
  byId(companyId: bigint): Promise<{ publicId: string; name: string } | null>;
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

export interface TaxClassAdminInfo {
  /** Internal id, as a string — this is what Product.taxClassId keys off (same
   *  "numeric id as string" convention as AttributeSetInfo/AttributeInfo). */
  id: string;
  publicId: string;
  code: string;
  name: string;
  /** The combined GST rate as a fraction string (e.g. "0.1800" for 18%) — the
   *  checkout-facing NativeGstTaxCalculator splits this into CGST+SGST or IGST
   *  at calculation time; nothing about the split is stored here. */
  rate: string;
  isActive: boolean;
}

export interface TaxClassRepository {
  create(input: { code: string; name: string; rate: string }): Promise<TaxClassAdminInfo>;
  findByCode(code: string): Promise<TaxClassAdminInfo | null>;
  /** Admin browse — the product-edit Tax Class picker and the standalone Tax Classes screen. */
  list(): Promise<TaxClassAdminInfo[]>;
  update(
    code: string,
    input: { name?: string; rate?: string; isActive?: boolean },
  ): Promise<TaxClassAdminInfo>;
  /** Soft-delete only — a deleted class simply stops resolving in TaxClassLookup
   *  (same reasoning as Coupon's soft-delete: no FK-driven reason to block it). */
  softDelete(code: string): Promise<void>;
}

/** This selling Website's own GST registration (single-registration/single-state
 *  scope — see store.prisma's Website.gstin/.originStateCode doc comment). Own
 *  copy, per-module lookup convention. */
export interface WebsiteTaxConfigLookup {
  byId(websiteId: bigint): Promise<{
    name: string;
    gstin: string | null;
    originStateCode: string | null;
    pricesIncludeTax: boolean;
    /** Freeform print-only address for the invoice letterhead — see store.prisma's Website.address doc comment. */
    address: string | null;
    /** S3 key for the invoice-letterhead logo — see store.prisma's Website.logoMediaKey doc comment. */
    logoMediaKey: string | null;
  } | null>;
}

/** This selling Website's admin-configured wallet-tender rules (plan/17) — own
 *  copy, per-module lookup convention (same reasoning as WebsiteTaxConfigLookup
 *  just above, kept separate rather than folded into it since these are an
 *  unrelated concern that happens to live on the same Website row). */
export interface WalletSettingsLookup {
  byId(websiteId: bigint): Promise<WalletSettings | null>;
}

export interface ShippingMethodInfo {
  code: string;
  name: string;
  flatRate: string;
  currency: string;
}

export interface ShippingMethodAdminInfo extends ShippingMethodInfo {
  publicId: string;
  isActive: boolean;
}

export interface ShippingMethodRepository {
  create(input: {
    code: string;
    name: string;
    flatRate: string;
    currency: string;
  }): Promise<{ publicId: string; code: string }>;
  findByCode(code: string): Promise<{ id: bigint; code: string } | null>;
  /** Storefront checkout needs to show real options, not a blind code (plan/14 Phase 7a) — active only. */
  list(currency: string): Promise<ShippingMethodInfo[]>;
  /** Admin list — every currency, including inactive ones (so they can be reactivated). */
  listAll(): Promise<ShippingMethodAdminInfo[]>;
  update(code: string, input: { name?: string; flatRate?: string; isActive?: boolean }): Promise<ShippingMethodAdminInfo>;
  /** Soft-delete only, same shape as DeleteTaxClass: a deleted method just stops being offered;
   *  any order that already used it keeps its own snapshotted shippingMethodCode/amount. */
  softDelete(code: string): Promise<void>;
}

export interface PaymentMethodInfo {
  code: string;
  name: string;
  type: PaymentMethodType;
}

export interface PaymentMethodAdminInfo extends PaymentMethodInfo {
  publicId: string;
  isActive: boolean;
}

export interface PaymentMethodRepository {
  create(input: { code: string; name: string; type: PaymentMethodType }): Promise<{ publicId: string; code: string }>;
  findByCode(code: string): Promise<PaymentMethodAdminInfo | null>;
  /** Storefront checkout — active only, no currency scope (unlike shipping, a payment
   *  method isn't tied to one currency). */
  list(): Promise<PaymentMethodInfo[]>;
  /** Admin list — every method, including inactive ones (so they can be reactivated). */
  listAll(): Promise<PaymentMethodAdminInfo[]>;
  update(code: string, input: { name?: string; isActive?: boolean }): Promise<PaymentMethodAdminInfo>;
  /** Soft-delete only — a deleted method just stops being offered; any order that already
   *  used it keeps its own snapshotted paymentMethod code untouched. */
  softDelete(code: string): Promise<void>;
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

/** Which stored-value instrument a cart intends to pay with — never a persisted amount (plan/15 Phase 5), matching couponCode. */
export interface CartTenderView {
  tenderType: TenderType;
  /** Set only for GIFT_CARD tenders. */
  giftCardId: bigint | null;
  createdAt: Date;
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
  /** Applied coupon code, if any — no FK, revalidated live on every read/checkout. */
  couponCode: string | null;
  lines: CartLineView[];
  tenders: CartTenderView[];
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
  /** null clears the applied coupon. Not itself validated here — callers (ApplyCouponToCart)
   *  validate via DiscountCalculator.evaluate() first. */
  setCouponCode(cartId: bigint, code: string | null): Promise<void>;

  /** Idempotent — re-adding the same (tenderType, giftCardId) is a no-op (the
   *  NULLS NOT DISTINCT unique index catches a WALLET-vs-WALLET collision;
   *  callers pre-check for an existing GIFT_CARD row by giftCardId to keep
   *  a re-apply from throwing a raw unique-violation). */
  addTender(cartId: bigint, tenderType: TenderType, giftCardId: bigint | null): Promise<void>;
  /** No-op if the tender isn't present. */
  removeTender(cartId: bigint, tenderType: TenderType, giftCardId: bigint | null): Promise<void>;

  /**
   * plan/15 Phase 6 — claims a guest cart for a just-logged-in customer and
   * re-derives its pricing group (today, the group is only ever set at cart
   * *creation*, so filling a cart before logging in silently kept retail
   * pricing forever). Only ever called on a cart that has no customer yet —
   * AttachCustomerToCart enforces that, this method trusts its caller.
   */
  attachCustomer(cartId: bigint, customerId: bigint, customerGroupId: bigint | null): Promise<void>;
}

// --- Order ---

export interface OrderLineInput {
  variantId: bigint;
  sku: string;
  name: string;
  qty: number;
  unitPriceMinor: bigint;
  taxAmountMinor: bigint;
  /** This line's share of the order's coupon discount (allocateProportionally,
   *  shared/domain/decimal.ts) — 0 for lines a coupon didn't apply to, or when no
   *  coupon was used at all. Informational only: NOT netted into rowTotalMinor
   *  below (rowTotal has never included discount, only Order.grandTotal does). */
  discountAmountMinor: bigint;
  rowTotalMinor: bigint;
  taxClassCode: string | null;
  /** Snapshot of Product.hsnCode as of order creation — never live-looked-up
   *  again afterward, same reasoning as sku/name/unitPrice on this row. */
  hsnCode: string | null;
}

export interface OrderAddressInput {
  type: AddressType;
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  /** 2-digit CBIC GST state code — see OrderAddress.stateCode's schema doc comment. */
  stateCode?: string | null;
  /** Buyer GSTIN, optional B2B capture. */
  gstin?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface OrderTaxLineInput {
  taxClassCode: string;
  taxType: 'CGST' | 'SGST' | 'IGST';
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
  /** plan/15 Phase 6 — resolved FRESH at checkout time from the buyer's
   *  company membership (not inherited from Cart, unlike customerGroupId
   *  above) and then snapshotted — a company's status/taxExempt flag
   *  changing later must never retroactively alter an already-placed order. */
  companyId: bigint | null;
  taxExempt: boolean;
  poNumber: string | null;
  email: string;
  currency: string;
  customerIp?: string | null;
  subtotalMinor: bigint;
  discountTotalMinor: bigint;
  taxTotalMinor: bigint;
  shippingTotalMinor: bigint;
  grandTotalMinor: bigint;
  shippingMethodCode: string;
  /** The PaymentMethod.code chosen at checkout, or null for a zero-due (fully tender-settled)
   *  order where cmd.paymentMethod was never required. Snapshot, not FK — see the schema
   *  column's own comment for why. */
  paymentMethodCode: string | null;
  couponCode: string | null;
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
  taxClassCode: string | null;
  hsnCode: string | null;
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
  stateCode: string | null;
  gstin: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface OrderTaxLineView {
  taxClassCode: string;
  taxType: 'CGST' | 'SGST' | 'IGST' | null;
  rate: string;
  amount: string;
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
  /** plan/15 Phase 2 — from the 1:1 shipment_tracking record, always present once the fulfillment exists. */
  carrierTrackingUrl: string | null;
  estimatedDeliveryAt: Date | null;
  currentStatus: string | null;
  shippingNotes: string | null;
  /** Internal-only (never serialized raw — see MediaUrlResolver's presign-not-proxy convention); the DTO layer exposes a boolean instead. */
  packingSlipStorageKey: string | null;
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
  lines: Array<{
    orderLineId: bigint;
    qty: number;
    unitPriceMinor: bigint;
    taxAmountMinor: bigint;
    rowTotalMinor: bigint;
  }>;
}

/** plan/15 Phase 3 — one row of the manual-send email log. */
export interface OrderEmailLogView {
  id: bigint;
  emailType: OrderEmailType;
  toEmail: string;
  subject: string;
  status: EmailLogStatus;
  providerRef: string | null;
  createdAt: Date;
}

export interface RecordEmailLogInput {
  orderId: bigint;
  emailType: OrderEmailType;
  toEmail: string;
  subject: string;
  status: EmailLogStatus;
  providerRef?: string | null;
  sentBy?: bigint | null;
}

export interface OrderView {
  id: bigint;
  publicId: string;
  orderNumber: string;
  websiteId: bigint;
  storeId: bigint;
  /** The cart this order was created from — StoredValueHold rows stay ref'd
   *  to this (refType CART), never re-pointed to the Order, so a split-tender
   *  refund finds "what funded this order" via findCapturedHoldsByRef('CART',
   *  order.cartId) rather than needing a second polymorphic ref (plan/15
   *  Phase 5). Not exposed on OrderViewDto — internal use only. */
  cartId: bigint | null;
  /** plan/15 Phase 11 — Reorder needs the original store view to create the new cart in the same scope. */
  storeViewId: bigint;
  customerId: bigint | null;
  /** plan/15 Phase 6 — snapshotted at checkout, see CreateOrderInput's identical field for why these aren't derived from Cart. */
  companyId: bigint | null;
  taxExempt: boolean;
  poNumber: string | null;
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
  paymentMethodCode: string | null;
  couponCode: string | null;
  customerIp: string | null;
  placedAt: Date;
  closedAt: Date | null;
  lines: OrderLineView[];
  addresses: OrderAddressView[];
  taxLines: OrderTaxLineView[];
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
  /** Only called when an auto-applied (not manually-entered) coupon loses its
   *  redeem() race after the order/lines were already created with the discount
   *  baked in — zeroes discount_total/coupon_code/each OrderLine.discount_amount
   *  and adds discount_total back onto grand_total, atomically, in one UPDATE
   *  per table (no app-side arithmetic needed to stay consistent with whatever
   *  was actually persisted at creation time). Returns the corrected grand
   *  total so the caller can charge the SAME amount it just persisted. */
  revertDiscount(orderId: bigint): Promise<{ grandTotalMinor: bigint }>;
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
    carrierTrackingUrl?: string | null;
    estimatedDeliveryAt?: Date | null;
    shippingNotes?: string | null;
    lines: Array<{ orderLineId: bigint; qty: number }>;
  }): Promise<{ id: bigint; publicId: string }>;
  /** plan/15 Phase 2 — stores the rendered packing-slip PDF's key on the fulfillment's 1:1 shipment_tracking row. */
  setPackingSlipKey(fulfillmentId: bigint, key: string): Promise<void>;
  /** plan/15 Phase 0b — appends one timeline row; called alongside (not instead of) the existing outbox.write() calls in every mutating usecase. */
  recordHistory(input: RecordOrderHistoryInput): Promise<void>;
  listHistory(orderId: bigint): Promise<OrderHistoryView[]>;
  addNote(input: AddOrderNoteInput): Promise<OrderNoteView>;
  /** plan/15 Phase 1 — race-safe per-website invoice-number sequence (next_invoice_number()), identical mechanics to nextOrderNumber. */
  nextInvoiceNumber(websiteId: bigint): Promise<bigint>;
  createInvoice(input: CreateInvoiceInput): Promise<OrderInvoiceView>;
  setInvoicePdfKey(invoiceId: bigint, key: string): Promise<void>;
  /** plan/15 Phase 3 — appends one email-log row (SENT or FAILED — the send attempt itself already happened by the time this is called). */
  recordEmailLog(input: RecordEmailLogInput): Promise<OrderEmailLogView>;
  listEmailLog(orderId: bigint): Promise<OrderEmailLogView[]>;
}
