import type { OrderStatus, FinancialStatus, FulfillmentStatus, TenderType } from '@prisma/client';

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
  /** This line's share of the applied coupon's discount (allocateProportionally),
   *  live-computed same as CartView.discountTotal — null when no coupon is applied,
   *  or 0 for a line an ITEM-target coupon's conditions didn't match. */
  discountAmount: string | null;
}

export interface CartView {
  publicId: string;
  currency: string;
  status: string;
  lines: CartLineDto[];
  /** Sum of every line's `lineTotal` that resolved to a real price; null if the cart has no priced lines yet. */
  subtotal: string | null;
  /** Applied coupon code, if any — either Cart.couponCode (manually entered) or, when
   *  that's unset, the code of a live-matched auto-apply coupon (see couponIsAutoApplied).
   *  Present even if a manually-entered one has since become invalid (see couponError). */
  couponCode: string | null;
  /** True when couponCode came from DiscountCalculator.findBestAutoApply() rather than
   *  Cart.couponCode — the customer never typed this code, so the UI should not offer
   *  a "Remove" action for it (there's nothing persisted to remove). */
  couponIsAutoApplied: boolean;
  /** Live-evaluated, never persisted — null when no coupon is applied or it's invalid. */
  discountTotal: string | null;
  /** Set instead of throwing when an applied coupon is no longer valid (expired, hit its
   *  usage limit, etc. since it was applied) — a cart read must never break because of
   *  this; checkout re-validates for real and hard-fails there instead. */
  couponError: string | null;
  /** subtotal - discountTotal (+ taxTotal when prices are tax-exclusive), or subtotal
   *  unchanged when no valid discount applies. Excludes shipping (only known at
   *  checkout) — same "estimated" framing the cart page already uses. */
  estimatedTotal: string | null;
  /** Website.pricesIncludeTax, resolved live on every read (not frozen at cart
   *  creation) — a later admin change to the setting should be reflected the
   *  next time this cart is read, same "always recomputed live" philosophy
   *  the coupon evaluation above already has. */
  pricesIncludeTax: boolean;
  /** Estimated GST across every priced line, pre-discount — the real amount,
   *  just without the final CGST/SGST-vs-IGST split/labels checkout shows
   *  once the shipping state is known (the combined rate, and so the total,
   *  is identical either way — only the label differs). Null when the cart
   *  has no priced lines yet, same convention as subtotal above. "0.0000"
   *  (not null) when priced lines exist but none carry a tax class. */
  taxTotal: string | null;
  /** Live-computed checkout tenders (plan/15 Phase 5) — wallet/gift-card
   *  instruments this cart intends to pay with, in the order they'll be
   *  drained at checkout (gift cards first, then wallet). Never a persisted
   *  amount, same "computed, not stored" philosophy as discountTotal. */
  tenders: CartTenderDto[];
  /** estimatedTotal minus the sum of every tender's appliedAmount — what's
   *  still due after stored-value tenders, before shipping (only known at
   *  checkout). Equals estimatedTotal when there are no tenders. Null when
   *  estimatedTotal itself is null (no priced lines yet). */
  amountDue: string | null;
  /** Set instead of throwing when a tender can no longer be resolved (e.g. a
   *  gift card was disabled/expired, or a wallet frozen, since being
   *  applied) — same soft-fail-on-read philosophy as couponError; checkout
   *  re-validates for real and hard-fails there instead. */
  tenderError: string | null;
}

export interface CartTenderDto {
  tenderType: TenderType;
  /** Only for GIFT_CARD tenders — the applied card's last 4 digits, so the UI can show which card without ever re-exposing the full code. */
  giftCardLast4: string | null;
  /** Only for GIFT_CARD tenders — the card's own publicId, safe to expose (not the raw redeemable code, not the internal bigint). This is what RemoveGiftCardFromCart targets: unlike apply (which needs bearer-code proof of possession), removal needs no such proof — "forget this tender from my cart" doesn't require re-proving the code, and the storefront never retains the full code past the moment it was typed to apply it. */
  giftCardPublicId: string | null;
  /** How much of amountDue this tender would actually cover right now, capped
   *  by its own live available balance and by what's still due after every
   *  tender applied before it. "0.0000" (not null) when the instrument has
   *  no available balance left to apply. */
  appliedAmount: string;
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
  /** 2-digit CBIC GST state code — feeds the CGST/SGST-vs-IGST determination
   *  (see complete-checkout.usecase.ts's TaxContext build). */
  stateCode?: string | null;
  /** Buyer GSTIN, optional B2B capture. */
  gstin?: string | null;
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
  /** Optional (plan/15 Phase 5) — omitted/unused when applied wallet/gift-card
   *  tenders cover the full total; CompleteCheckout validates it's present
   *  whenever anything is still due after tenders are resolved. */
  paymentMethod?: string;
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
  taxClassCode: string | null;
  hsnCode: string | null;
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
  stateCode: string | null;
  gstin: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface OrderTaxLineDto {
  taxClassCode: string;
  taxType: 'CGST' | 'SGST' | 'IGST' | null;
  rate: string;
  amount: string;
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
  couponCode: string | null;
  customerIp: string | null;
  placedAt: string;
  closedAt: string | null;
  lines: OrderLineViewDto[];
  addresses: OrderAddressDto[];
  taxLines: OrderTaxLineDto[];
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

export interface OrderTrackingDto {
  fulfillments: FulfillmentDto[];
  history: OrderHistoryDto[];
}

export interface ReorderSkippedLineDto {
  sku: string;
  name: string;
  reason: string;
}

export interface ReorderResultDto {
  cartPublicId: string;
  skipped: ReorderSkippedLineDto[];
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
