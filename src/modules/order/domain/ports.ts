/**
 * Tax/Shipping/Payment ports (plan/00 §9 decision: "native + adapter interface").
 * These are the plug points for a future Avalara/TaxJar-style tax adapter, a real
 * carrier-rate shipping integration, or a live payment gateway (Stripe/Adyen/...);
 * today each has a minimal native/test implementation in ../infrastructure.
 */

export interface TaxLineInput {
  variantId: bigint;
  lineSubtotalMinor: bigint;
}

export interface TaxLineResult {
  variantId: bigint;
  taxClassCode: string | null;
  rateMinor: bigint;
  amountMinor: bigint;
}

export interface TaxCalculator {
  calculate(lines: TaxLineInput[]): Promise<TaxLineResult[]>;
}

export interface ShippingQuote {
  methodCode: string;
  amountMinor: bigint;
}

export interface ShippingCalculator {
  /** Returns null if the method code is unknown or not offered in this currency. */
  quote(methodCode: string, currency: string): Promise<ShippingQuote | null>;
}

export type PaymentOutcome = 'SUCCEEDED' | 'FAILED';

export interface CaptureInput {
  orderId: bigint;
  amountMinor: bigint;
  currency: string;
  method: string;
  /** Test-only seam (mirrors real gateways' test-card conventions) — defaults to 'approve'. */
  testScenario?: 'approve' | 'decline';
}

export interface RefundInput {
  orderId: bigint;
  amountMinor: bigint;
  currency: string;
  method: string;
}

export interface PaymentResult {
  status: PaymentOutcome;
  gatewayRef: string;
  raw?: unknown;
}

export interface PaymentGateway {
  capture(input: CaptureInput): Promise<PaymentResult>;
  refund(input: RefundInput): Promise<PaymentResult>;
}

/** Resolves a stored media key to a fresh, short-lived GET URL (plan/14 Phase 5a) — own copy of search's identical port; presigned S3/MinIO URLs expire in 15 minutes (shared/infrastructure/storage/s3-client.ts), so this is called per-request, never cached. */
export interface MediaUrlResolver {
  presignGetUrl(key: string): Promise<string>;
}
