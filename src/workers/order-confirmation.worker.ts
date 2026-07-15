import { Worker, type Job } from 'bullmq';
import { DOMAIN_EVENTS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { logger } from '../shared/infrastructure/logger.js';

/**
 * Consumes OrderPaid events relayed from the outbox and simulates sending a
 * confirmation email (no real email provider is wired up — Notifications is
 * out of scope for this stage; this proves the event-driven consumer pattern
 * end-to-end with a real BullMQ worker processing real outbox-relayed jobs).
 * Idempotent by construction: logging twice for the same order is harmless,
 * which is exactly what makes the outbox's at-least-once delivery acceptable
 * for OrderPaid's non-same-transaction write (see prisma/schema/system.prisma).
 */
export function startOrderConfirmationWorker(): Worker {
  const worker = new Worker(
    DOMAIN_EVENTS_QUEUE,
    async (job: Job) => {
      if (job.name !== 'OrderPaid') return; // this worker only reacts to OrderPaid
      const { aggregateId, payload } = job.data as { aggregateId: string; payload: { orderNumber: string; grandTotal: string } };
      logger.info(
        { orderId: aggregateId, orderNumber: payload.orderNumber, grandTotal: payload.grandTotal },
        `[simulated] sending order confirmation email for order #${payload.orderNumber}`,
      );
    },
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'order confirmation worker job failed'));
  return worker;
}
