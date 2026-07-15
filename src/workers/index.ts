import { OutboxRelay } from '../shared/infrastructure/outbox/outbox-relay.js';
import { getDomainEventsQueue } from '../shared/infrastructure/queue/queues.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { startOrderConfirmationWorker } from './order-confirmation.worker.js';
import { startReservationSweepWorker, scheduleReservationSweep } from './reservation-sweep.worker.js';
import { startSearchIndexerWorker } from './search-indexer.worker.js';
import { startBulkImportWorker } from './bulk-import.worker.js';
import { logger } from '../shared/infrastructure/logger.js';

export interface WorkerHandles {
  outboxRelay: OutboxRelay;
  stop(): Promise<void>;
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

  const orderConfirmationWorker = startOrderConfirmationWorker();
  const reservationSweepWorker = startReservationSweepWorker();
  const searchIndexerWorker = startSearchIndexerWorker();
  const bulkImportWorker = startBulkImportWorker();
  await scheduleReservationSweep();

  logger.info('background workers started (outbox relay, order confirmation, reservation sweep, search indexer, bulk import)');

  return {
    outboxRelay,
    async stop() {
      outboxRelay.stop();
      await Promise.allSettled([
        orderConfirmationWorker.close(),
        reservationSweepWorker.close(),
        searchIndexerWorker.close(),
        bulkImportWorker.close(),
      ]);
    },
  };
}
