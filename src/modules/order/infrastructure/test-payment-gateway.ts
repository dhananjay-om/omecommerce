import { randomUUID } from 'node:crypto';
import type { PaymentGateway, CaptureInput, RefundInput, PaymentResult } from '../domain/ports.js';

/**
 * Test payment gateway (plan/00 §9: native + adapter interface — a real
 * Stripe/Adyen/... adapter implements the same PaymentGateway port). Mirrors how
 * real test gateways work: a `testScenario` flag simulates approve/decline,
 * exactly like magic test-card numbers, rather than always succeeding.
 */
export class TestPaymentGateway implements PaymentGateway {
  async capture(input: CaptureInput): Promise<PaymentResult> {
    const gatewayRef = `test_${randomUUID()}`;
    if (input.testScenario === 'decline') {
      return { status: 'FAILED', gatewayRef, raw: { reason: 'test_decline_requested' } };
    }
    return { status: 'SUCCEEDED', gatewayRef, raw: { simulated: true } };
  }

  async refund(_input: RefundInput): Promise<PaymentResult> {
    return { status: 'SUCCEEDED', gatewayRef: `test_refund_${randomUUID()}` };
  }
}
