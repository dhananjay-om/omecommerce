export interface ShippingMethod {
  code: string;
  name: string;
  flatRate: string;
  currency: string;
}

export interface PaymentMethod {
  code: string;
  name: string;
  type: 'COD' | 'ONLINE';
}

export interface OrderLineView {
  sku: string;
  name: string;
  qty: number;
  unitPrice: string;
  /** "MRP" / compare-at price snapshotted at checkout time — null when the resolved price had none. */
  mrp: string | null;
  taxAmount: string;
  discountAmount: string;
  rowTotal: string;
  taxClassCode: string | null;
  hsnCode: string | null;
  fulfilledQty: number;
  refundedQty: number;
}

export interface OrderAddress {
  type: 'BILLING' | 'SHIPPING';
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

export interface OrderTaxLine {
  taxClassCode: string;
  taxType: 'CGST' | 'SGST' | 'IGST' | null;
  rate: string;
  amount: string;
}

export interface OrderPayment {
  method: string;
  gateway: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  gatewayRef: string | null;
  createdAt: string;
}

export interface OrderFulfillmentLine {
  sku: string;
  qty: number;
}

export interface OrderFulfillment {
  publicId: string;
  status: string;
  trackingNumber: string | null;
  carrier: string | null;
  carrierTrackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  currentStatus: string | null;
  shippingNotes: string | null;
  hasPackingSlip: boolean;
  shippedAt: string | null;
  createdAt: string;
  lines: OrderFulfillmentLine[];
}

export interface OrderNote {
  id: string;
  type: 'INTERNAL' | 'CUSTOMER';
  body: string;
  createdAt: string;
}

export interface OrderInvoice {
  publicId: string;
  invoiceNumber: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  createdAt: string;
}

export interface OrderView {
  publicId: string;
  orderNumber: string;
  email: string;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  subtotal: string;
  discountTotal: string;
  couponCode: string | null;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
  placedAt: string;
  closedAt: string | null;
  lines: OrderLineView[];
  addresses: OrderAddress[];
  taxLines: OrderTaxLine[];
  payments: OrderPayment[];
  fulfillments: OrderFulfillment[];
  notes: OrderNote[];
  invoices: OrderInvoice[];
}

export interface OrderTrackingHistoryEntry {
  id: string;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  actorType: string;
  actorName: string | null;
  createdAt: string;
}

export interface OrderTracking {
  fulfillments: OrderFulfillment[];
  history: OrderTrackingHistoryEntry[];
}
