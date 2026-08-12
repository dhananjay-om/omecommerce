import type { Job } from 'bullmq';
import { logger } from '../shared/infrastructure/logger.js';

/**
 * Reacts to OrderPaid events relayed from the outbox and simulates sending a
 * confirmation email (no real email provider is wired up — Notifications is
 * out of scope for this stage; this proves the event-driven consumer pattern
 * end-to-end with real outbox-relayed jobs). Idempotent by construction:
 * logging twice for the same order is harmless, which is exactly what makes
 * the outbox's at-least-once delivery acceptable for OrderPaid's
 * non-same-transaction write (see prisma/schema/system.prisma).
 *
 * Exported as a plain handler, not its own Worker: DOMAIN_EVENTS_QUEUE has
 * several logical consumers (this, search indexing, loyalty earn/clawback),
 * but BullMQ delivers each job to exactly ONE Worker attached to a given
 * queue name — separate Worker instances on the same queue COMPETE for jobs
 * rather than each getting a copy. All domain-events consumers therefore run
 * inside the single Worker wired in workers/index.ts, each guarding on its
 * own job.name.
 */
export async function handleOrderConfirmation(job: Job): Promise<void> {
  if (job.name !== 'OrderPaid') return;
  const { aggregateId, payload } = job.data as { aggregateId: string; payload: { orderNumber: string; grandTotal: string } };
  logger.info(
    { orderId: aggregateId, orderNumber: payload.orderNumber, grandTotal: payload.grandTotal },
    `[simulated] sending order confirmation email for order #${payload.orderNumber}`,
  );
}
