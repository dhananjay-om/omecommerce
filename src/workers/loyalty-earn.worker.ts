import { Worker, type Job } from 'bullmq';
import { DOMAIN_EVENTS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { createLoyaltyEarnDeps } from '../modules/loyalty/loyalty.module.js';
import { logger } from '../shared/infrastructure/logger.js';

const EARN_EVENTS = new Set(['OrderPaid']);
const CLAWBACK_EVENTS = new Set(['OrderRefunded']);

/**
 * Consumes Order's outbox events to earn/claw back loyalty points (plan/11
 * §2.2). `OrderPaid` -> EarnLoyaltyPoints (idempotent on `earn-<orderId>`,
 * safe against BullMQ's at-least-once redelivery). `OrderRefunded` ->
 * ReverseLoyaltyPoints, keyed on the job's own id (`outbox-<row.id>`) rather
 * than the order id, since one order can have multiple partial refunds, each
 * its own outbox row — an order-scoped key would wrongly dedupe a second real
 * refund against the first (see ReverseLoyaltyPoints's header comment).
 *
 * Both are silent no-ops for guest orders or websites with no active loyalty
 * program — not an error condition (see EarnLoyaltyPoints's header comment).
 *
 * Exported as a handler factory, not its own Worker — see
 * order-confirmation.worker.ts's header comment on why DOMAIN_EVENTS_QUEUE's
 * consumers all share ONE Worker (wired in workers/index.ts) instead of one
 * each.
 */
export function createLoyaltyEarnHandler(): (job: Job) => Promise<void> {
  const { earn, reverse } = createLoyaltyEarnDeps(prisma);

  return async (job: Job) => {
    if (EARN_EVENTS.has(job.name)) {
      const { aggregateId } = job.data as { aggregateId: string };
      await earn.execute(aggregateId);
    } else if (CLAWBACK_EVENTS.has(job.name)) {
      const { aggregateId, payload } = job.data as { aggregateId: string; payload: { amount: string } };
      await reverse.execute(aggregateId, payload.amount, job.id!);
    }
  };
}

/**
 * Standalone convenience wrapper around createLoyaltyEarnHandler() that owns
 * its own Worker — used only by loyalty-api.test.ts's documented in-test
 * worker exception (bulk-import-api.test.ts's pattern), where no other
 * domain-events consumer runs alongside it so the "one shared Worker per
 * queue" constraint above doesn't apply.
 */
export function startLoyaltyEarnWorker(): Worker {
  const handler = createLoyaltyEarnHandler();
  const worker = new Worker(DOMAIN_EVENTS_QUEUE, handler, { connection: getQueueConnectionOptions() });
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'loyalty earn/clawback job failed'));
  return worker;
}
