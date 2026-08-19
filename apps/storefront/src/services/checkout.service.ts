import { api } from '@/lib/axios';
import type { OrderView } from '@/types/order';

export interface CheckoutAddress {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  /** 2-digit CBIC GST state code — feeds the CGST/SGST-vs-IGST determination. */
  stateCode?: string | null;
  gstin?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface CheckoutInput {
  email: string;
  billingAddress: CheckoutAddress;
  shippingAddress: CheckoutAddress;
  shippingMethodCode: string;
  paymentMethod: string;
  /** Test-only seam mirroring TestPaymentGateway's own (plan/14 Phase 7 — no real payment processor exists). */
  testScenario?: 'approve' | 'decline';
  /** A B2B buyer's purchase-order reference (plan/15 Phase 7) — print-only, snapshotted onto Order.poNumber regardless of whether credit terms are actually used on this order. */
  poNumber?: string | null;
}

/**
 * Client Component mutations only — via the same-origin /api/checkout Route
 * Handler. A fresh Idempotency-Key per checkout ATTEMPT (not per component
 * mount) protects against a double-click or network retry submitting the
 * same order twice; the backend's idempotency middleware replays the first
 * response for a repeat of the same key (plan/03 §6).
 */
export async function completeCheckout(input: CheckoutInput): Promise<OrderView> {
  const res = await api.post<OrderView>('/checkout', input, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  return res.data;
}
