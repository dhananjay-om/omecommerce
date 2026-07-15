import { Worker, type Job } from 'bullmq';
import { DOMAIN_EVENTS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { createReferralWorkerDeps } from '../modules/referral/referral.module.js';
import { logger } from '../shared/infrastructure/logger.js';

const QUALIFY_EVENTS = new Set(['OrderPaid']);
const CLAWBACK_EVENTS = new Set(['OrderRefunded']);

/**
 * Consumes Order's outbox events to qualify/claw back the referrer's
 * referral reward (plan/11 §3.2). `OrderPaid` -> QualifyReferral (a no-op
 * unless the buyer is a SIGNED_UP referee of a FIRST_ORDER-qualifying
 * program — a SIGNUP-qualifying program already rewarded the referrer at
 * attach time). `OrderRefunded` -> ReverseReferralReward — unlike Loyalty's
 * clawback, this is a single flat reversal keyed on the referral itself
 * (`referral-reward-reverse-<referralId>`, derived inside the use-case, not
 * passed from here), not one per refund event: a referral reward is a flat
 * milestone bonus, not proportional to spend, so the first refund of the
 * qualifying order reverses it once and for all (Referral.status ->
 * REVERSED then guards any further OrderRefunded delivery for the same
 * order from re-attempting it).
 *
 * Exported as a handler factory, not its own Worker — see
 * order-confirmation.worker.ts's header comment on why DOMAIN_EVENTS_QUEUE's
 * consumers all share ONE Worker (wired in workers/index.ts) instead of one
 * each.
 */
export function createReferralQualifyHandler(): (job: Job) => Promise<void> {
  const { qualify, reverse } = createReferralWorkerDeps(prisma);

  return async (job: Job) => {
    if (QUALIFY_EVENTS.has(job.name)) {
      const { aggregateId } = job.data as { aggregateId: string };
      await qualify.execute(aggregateId);
    } else if (CLAWBACK_EVENTS.has(job.name)) {
      const { aggregateId } = job.data as { aggregateId: string };
      await reverse.execute(aggregateId);
    }
  };
}

/**
 * Standalone convenience wrapper around createReferralQualifyHandler() that
 * owns its own Worker — used only by referral-api.test.ts's documented
 * in-test worker exception (bulk-import-api.test.ts's pattern), where no
 * other domain-events consumer runs alongside it so the "one shared Worker
 * per queue" constraint above doesn't apply.
 */
export function startReferralQualifyWorker(): Worker {
  const handler = createReferralQualifyHandler();
  const worker = new Worker(DOMAIN_EVENTS_QUEUE, handler, { connection: getQueueConnectionOptions() });
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'referral qualify/clawback job failed'));
  return worker;
}
