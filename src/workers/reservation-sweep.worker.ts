import { Worker } from 'bullmq';
import { getMaintenanceQueue, MAINTENANCE_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { ReleaseExpiredReservations } from '../modules/inventory/application/release-expired-reservations.usecase.js';
import { PrismaStockLedger } from '../modules/inventory/infrastructure/prisma-stock-ledger.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';

const SWEEP_JOB_NAME = 'sweep-expired-reservations';
const SWEEP_INTERVAL_MS = 60_000; // every minute

/**
 * Schedules the reservation-expiry sweep as a real repeatable BullMQ job —
 * fulfilling the deferral explicitly documented in
 * src/modules/inventory/application/release-expired-reservations.usecase.ts
 * ("Not yet wired to a scheduler — BullMQ cron integration is Stage 3"). The
 * admin-triggered manual endpoint (POST .../reservations/sweep-expired) still
 * works and is useful for tests/on-demand runs; this is the always-on schedule.
 */
export async function scheduleReservationSweep(): Promise<void> {
  const queue = getMaintenanceQueue();
  await queue.add(
    SWEEP_JOB_NAME,
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: SWEEP_JOB_NAME },
  );
}

export function startReservationSweepWorker(): Worker {
  const releaseExpired = new ReleaseExpiredReservations(new PrismaStockLedger(prisma));
  const worker = new Worker(
    MAINTENANCE_QUEUE,
    async (job) => {
      if (job.name !== SWEEP_JOB_NAME) return;
      const result = await releaseExpired.execute();
      if (result.releasedCount > 0) {
        logger.info({ releasedCount: result.releasedCount }, 'reservation sweep released expired reservations');
      }
    },
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'reservation sweep job failed'));
  return worker;
}
