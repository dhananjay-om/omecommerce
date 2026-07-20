import type {
  CartStatus,
  AddressType,
  PaymentTxnType,
  PaymentTxnStatus,
  ShipmentStatus,
  FinancialStatus,
  OrderStatus,
  FulfillmentStatus,
} from '@prisma/client';

// --- Cross-module read-only lookups (each module resolves its own dependencies) ---

export interface VariantLookup {
  byPublicId(publicId: string): Promise<{ id: bigint; sku: string; nameDefault: string | null } | null>;
  byId(id: bigint): Promise<{ sku: string; nameDefault: string | null } | null>;
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

export interface ShippingMethodRepository {
  create(input: { code: string; name: string; flatRate: string; currency: string }): Promise<{ publicId: string; code: string }>;
  findByCode(code: string): Promise<{ id: bigint; code: string } | null>;
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
  rowTotal: string;
  fulfilledQty: number;
  refundedQty: number;
  version: number;
}

export interface OrderView {
  id: bigint;
  publicId: string;
  orderNumber: string;
  websiteId: bigint;
  storeId: bigint;
  email: string;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  lines: OrderLineView[];
}

export interface OrderListItem {
  publicId: string;
  orderNumber: string;
  email: string;
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
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  email?: string;
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
    lines: Array<{ orderLineId: bigint; qty: number }>;
  }): Promise<{ id: bigint; publicId: string }>;
}
