import { Worker, type Job } from 'bullmq';
import { OutboxRelay } from '../shared/infrastructure/outbox/outbox-relay.js';
import { DOMAIN_EVENTS_QUEUE, MAINTENANCE_QUEUE, getDomainEventsQueue } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { createOrderNotificationHandler } from './order-confirmation.worker.js';
import { createReservationSweepHandler, scheduleReservationSweep } from './reservation-sweep.worker.js';
import { createStoredValueHoldSweepHandler, scheduleStoredValueHoldSweep } from './stored-value-hold-sweep.worker.js';
import { createSearchIndexHandler } from './search-indexer.worker.js';
import { startBulkImportWorker } from './bulk-import.worker.js';
import { startCatalogMigrationWorker } from './catalog-migration.worker.js';
import { createLoyaltyEarnHandler } from './loyalty-earn.worker.js';
import { createReferralQualifyHandler } from './referral-qualify.worker.js';
import { createAnalyticsProjectorHandler } from './analytics-projector.worker.js';
import { createAnalyticsRefreshHandler, scheduleAnalyticsRefresh } from './analytics-refresh.worker.js';
import { createAiRefreshHandler, scheduleAiRefresh } from './ai-refresh.worker.js';
import { logger } from '../shared/infrastructure/logger.js';

export interface WorkerHandles {
  outboxRelay: OutboxRelay;
  stop(): Promise<void>;
}

/**
 * DOMAIN_EVENTS_QUEUE has several logical consumers (order confirmation,
 * search indexing, loyalty earn/clawback, referral qualify/clawback), but
 * BullMQ delivers each job to exactly ONE Worker attached to a given queue
 * name — separate Worker instances on the same queue COMPETE for jobs rather
 * than each getting a copy. All of them therefore run inside this single
 * Worker, dispatched by job name; each handler independently no-ops for job
 * names it doesn't care about. A handler's failure is logged and does not
 * stop the others from running for the same job (each handler's own
 * idempotency is what makes re-processing that job later, e.g. after a fix,
 * safe).
 */
function startDomainEventsWorker(): Worker {
  const handlers: Array<(job: Job) => Promise<void>> = [
    createOrderNotificationHandler(),
    createSearchIndexHandler(),
    createLoyaltyEarnHandler(),
    createReferralQualifyHandler(),
    createAnalyticsProjectorHandler(),
  ];

  const worker = new Worker(
    DOMAIN_EVENTS_QUEUE,
    async (job) => {
      for (const handler of handlers) {
        try {
          await handler(job);
        } catch (err) {
          logger.error({ err, jobId: job.id, jobName: job.name }, 'domain-events handler failed');
        }
      }
    },
    { connection: getQueueConnectionOptions() },
  );
  return worker;
}

/**
 * `maintenance` has two logical sweeps (stock reservations, stored-value
 * holds — plan/15 Phase 5) — same "one Worker per queue, dispatch by job
 * name" reasoning as startDomainEventsWorker() above, not two separate
 * Worker instances competing for the same queue's jobs.
 */
function startMaintenanceWorker(): Worker {
  const handlers: Array<(job: Job) => Promise<void>> = [
    createReservationSweepHandler(),
    createStoredValueHoldSweepHandler(),
    createAnalyticsRefreshHandler(),
    createAiRefreshHandler(),
  ];

  const worker = new Worker(
    MAINTENANCE_QUEUE,
    async (job) => {
      for (const handler of handlers) {
        try {
          await handler(job);
        } catch (err) {
          logger.error({ err, jobId: job.id, jobName: job.name }, 'maintenance handler failed');
        }
      }
    },
    { connection: getQueueConnectionOptions() },
  );
  return worker;
}

/**
 * Starts background processing (Stage 3/4 cross-cutting infra): the outbox
 * relay plus its consumers. Called only from main.ts (the actual running server
 * process) — never from createApp()/tests, so the test suite doesn't spin up
 * BullMQ workers or Redis connections it doesn't need.
 */
export async function startWorkers(): Promise<WorkerHandles> {
  const domainEventsQueue = getDomainEventsQueue();
  const outboxRelay = new OutboxRelay(prisma, domainEventsQueue);
  outboxRelay.start();

  const domainEventsWorker = startDomainEventsWorker();
  const maintenanceWorker = startMaintenanceWorker();
  const bulkImportWorker = startBulkImportWorker();
  const catalogMigrationWorker = startCatalogMigrationWorker();
  await scheduleReservationSweep();
  await scheduleStoredValueHoldSweep();
  await scheduleAnalyticsRefresh();
  await scheduleAiRefresh();

  logger.info(
    'background workers started (outbox relay, domain events [order confirmation, search indexer, loyalty earn, referral qualify, analytics projector], maintenance [reservation sweep, stored-value hold sweep, analytics nightly refresh, AI insights nightly refresh], bulk import, catalog migration)',
  );

  return {
    outboxRelay,
    async stop() {
      outboxRelay.stop();
      await Promise.allSettled([domainEventsWorker.close(), maintenanceWorker.close(), bulkImportWorker.close(), catalogMigrationWorker.close()]);
    },
  };
}
