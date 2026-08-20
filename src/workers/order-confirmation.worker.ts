import type { Job } from 'bullmq';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { createOrderEmailDeps } from '../modules/order/order.module.js';
import { logger } from '../shared/infrastructure/logger.js';

/** Which templated OrderEmailType each outbox event triggers automatically —
 *  see order-email-templates.ts for what each one actually sends. INVOICE and
 *  CUSTOM are deliberately absent: INVOICE stays admin-triggered (an invoice
 *  is a distinct billing document, not every order gets one the moment it's
 *  placed), CUSTOM only ever comes from an admin-authored message. */
const EVENT_TO_EMAIL_TYPE: Record<string, 'CONFIRMATION' | 'SHIPMENT' | 'CANCELLATION' | 'REFUND'> = {
  // OrderPlaced already existed (prisma-order.repository.ts writes it
  // same-transaction as the order row, for true atomicity) but had zero
  // consumers before this — it fires unconditionally for EVERY order
  // creation, regardless of payment method, which is exactly what a
  // confirmation email needs (a COD order never fires OrderPaid at all).
  OrderPlaced: 'CONFIRMATION',
  Shipped: 'SHIPMENT',
  OrderCancelled: 'CANCELLATION',
  OrderRefunded: 'REFUND',
};

/**
 * Reacts to Order's outbox events and sends the matching transactional email
 * for real (via SendOrderEmail — the exact same usecase the admin's manual
 * "Send Email" button calls, so both paths log to the same OrderEmailLog and
 * record the same order-history entry). Goes through whatever EmailSender
 * order.module.ts's createEmailSender() selected — a real SMTP provider once
 * SMTP_USER/SMTP_PASS are configured, the SimulatedEmailSender (log-only)
 * fallback otherwise.
 *
 * No extra idempotency guard beyond SendOrderEmail's own append-only log:
 * BullMQ's at-least-once redelivery could in principle send one email twice
 * on a rare crash-mid-processing, which is an acceptable, already-documented
 * trade-off for a notification (not a money-moving) side effect — same
 * reasoning this file's stub predecessor stated for the simulated case, now
 * just extended to a real provider. A stricter per-order-per-type dedupe
 * would also incorrectly suppress a genuine second SHIPMENT email for a
 * second partial fulfillment on the same order.
 *
 * Exported as a handler factory, not its own Worker: DOMAIN_EVENTS_QUEUE has
 * several logical consumers (this, search indexing, loyalty earn/clawback),
 * but BullMQ delivers each job to exactly ONE Worker attached to a given
 * queue name — separate Worker instances on the same queue COMPETE for jobs
 * rather than each getting a copy. All domain-events consumers therefore run
 * inside the single Worker wired in workers/index.ts, each guarding on its
 * own job.name.
 */
export function createOrderNotificationHandler(): (job: Job) => Promise<void> {
  const { sendOrderEmail, orders } = createOrderEmailDeps(prisma);

  return async (job: Job) => {
    const emailType = EVENT_TO_EMAIL_TYPE[job.name];
    if (!emailType) return;
    const { aggregateId } = job.data as { aggregateId: string };
    try {
      if (emailType === 'CONFIRMATION') {
        // OrderPlaced fires the instant the order row commits, BEFORE
        // checkout even attempts payment — an order whose payment is then
        // declined gets cancelled a moment later in the same request. Checked
        // here (the automatic path only), not inside SendOrderEmail itself,
        // which the admin's manual "Send Email" button also calls and where
        // deliberately sending a CONFIRMATION for a cancelled order could be
        // a real admin choice (e.g. resending on request).
        const order = await orders.findByPublicId(aggregateId);
        if (!order || order.status === 'CANCELLED') return;
      }
      await sendOrderEmail.execute({ orderPublicId: aggregateId, type: emailType });
    } catch (err) {
      // NotFoundError etc. — the order lookup itself failed, not just the
      // send (SendOrderEmail already swallows a send failure into a logged
      // FAILED status). Logged, not rethrown: matches every other domain-
      // events handler's own try/catch in workers/index.ts, but stated
      // explicitly here since this one can also throw from validation.
      logger.error({ err, orderId: aggregateId, emailType }, 'automatic order-lifecycle email failed');
    }
  };
}
