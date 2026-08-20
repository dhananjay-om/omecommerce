import { z } from 'zod';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@prisma/client';

/** Normalizes a whitespace-only or blank string to undefined before the real
 *  schema sees it — an untouched optional field can arrive as '' or ' ' (a
 *  stray space, browser autofill, etc.), neither of which a format regex
 *  would ever match, so without this an optional field silently becomes a
 *  hard validation failure. Defense in depth: the storefront already tries
 *  to do this client-side, but this is the layer every caller goes through. */
function blankToUndefined(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? undefined : val), schema);
}

// plan/15 Phase 6 — customerGroupCode is intentionally gone: a plain
// z.object() (not .strict()) silently strips any unknown field a stale
// client still sends, rather than erroring — the group is always
// server-derived now regardless of what the request body contains.
export const createCartSchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'expected numeric id'),
  customerPublicId: z.string().uuid().nullish(),
});

export const addCartLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().positive(),
});

export const applyGiftCardToCartSchema = z.object({
  code: z.string().min(1).max(32),
});

export const removeGiftCardFromCartSchema = z.object({
  giftCardPublicId: z.string().uuid(),
});

const addressSchema = z
  .object({
    name: z.string().min(1),
    company: z.string().nullish(),
    line1: z.string().min(1),
    line2: z.string().nullish(),
    city: z.string().min(1),
    region: z.string().nullish(),
    /** 2-digit CBIC GST state code — feeds the CGST/SGST-vs-IGST determination. */
    stateCode: blankToUndefined(z.string().regex(/^\d{2}$/, 'expected a 2-digit GST state code, e.g. "27"').nullish()),
    gstin: blankToUndefined(
      z
        .string()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'expected a valid 15-character GSTIN')
        .nullish(),
    ),
    postalCode: z.string().min(1),
    country: z.string().length(2),
    phone: z.string().nullish(),
  })
  // Defense in depth alongside the DB's order_address_gstin_state_match CHECK
  // (a GSTIN's first 2 digits are its state by construction) — without this,
  // a mismatch here hits the raw Postgres CHECK and surfaces as an unhandled
  // 500 instead of a clean validation error, the same class of gap already
  // fixed for the admin GST Settings form.
  .refine((addr) => !addr.gstin || !addr.stateCode || addr.gstin.slice(0, 2) === addr.stateCode, {
    message: "GST state must match the GSTIN's first 2 digits",
    path: ['stateCode'],
  });

export const completeCheckoutSchema = z.object({
  email: z.string().email(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  shippingMethodCode: z.string().min(1),
  // Optional (plan/15 Phase 5) — CompleteCheckout itself validates it's
  // present whenever anything is still due after wallet/gift-card tenders.
  paymentMethod: z.string().min(1).optional(),
  testScenario: z.enum(['approve', 'decline']).optional(),
  poNumber: z.string().max(64).nullish(),
});

export const fulfillOrderSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
  trackingNumber: z.string().max(128).optional(),
  carrier: z.string().max(128).optional(),
  /** plan/15 Phase 2 additions. */
  carrierTrackingUrl: z.string().url().max(2048).optional(),
  estimatedDeliveryAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'expected a date, e.g. "2026-07-01"').optional(),
  shippingNotes: z.string().max(2000).optional(),
});

const refundToSchema = z.enum(['ORIGINAL_PAYMENT_METHOD', 'WALLET']);

export const refundOrderSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
  restock: z.boolean().optional(),
  refundTo: refundToSchema.optional(),
});

/** Every field optional — a bare `POST .../cancel` with an empty body keeps working exactly as before (plan/15 Phase 0e added reason/refundTo, didn't require them). */
export const cancelOrderSchema = z.object({
  reason: z.string().max(1024).optional(),
  refundTo: refundToSchema.optional(),
});

export const addOrderNoteSchema = z.object({
  type: z.enum(['INTERNAL', 'CUSTOMER']),
  body: z.string().min(1).max(4000),
});

/** Omitting `lines` entirely invoices every line's full remaining qty (plan/15 Phase 1). */
export const createInvoiceSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1).optional(),
});

/** subject/body are optional at the schema layer — required only for type=CUSTOM, enforced in SendOrderEmail (plan/15 Phase 3). */
export const sendOrderEmailSchema = z.object({
  type: z.enum(['CONFIRMATION', 'INVOICE', 'SHIPMENT', 'CANCELLATION', 'REFUND', 'CUSTOM']),
  subject: z.string().min(1).max(256).optional(),
  body: z.string().min(1).max(20000).optional(),
});

export const createTaxClassSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  rate: z.string().regex(/^0\.\d{1,4}$|^0$/, 'expected a fraction like "0.18" for 18% GST'),
});

export const updateTaxClassSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  rate: z.string().regex(/^0\.\d{1,4}$|^0$/, 'expected a fraction like "0.18" for 18% GST').optional(),
  isActive: z.boolean().optional(),
});

export const createShippingMethodSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  flatRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount'),
  currency: z.string().length(3),
});

export const updateShippingMethodSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  flatRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'expected a decimal amount').optional(),
  isActive: z.boolean().optional(),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['createdAt', 'grandTotal', 'customerName']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  financialStatus: z.nativeEnum(FinancialStatus).optional(),
  fulfillmentStatus: z.nativeEnum(FulfillmentStatus).optional(),
  email: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  // Accepts a plain "YYYY-MM-DD" (what a native <input type="date"> sends) or a
  // full ISO datetime — both parse fine via `new Date(...)` in the usecase.
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'expected a date, e.g. "2026-07-01"').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'expected a date, e.g. "2026-07-01"').optional(),
});

/** Same filters as listOrdersQuerySchema (minus pagination — export always returns everything up to the cap) plus format (plan/15 Phase 4). */
export const exportOrdersQuerySchema = listOrdersQuerySchema.omit({ page: true, pageSize: true, sortBy: true, sortDir: true }).extend({
  format: z.enum(['csv', 'xlsx']).default('csv'),
});
