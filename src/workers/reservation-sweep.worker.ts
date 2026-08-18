import type { Job } from 'bullmq';
import { getMaintenanceQueue } from '../shared/infrastructure/queue/queues.js';
import { ReleaseExpiredReservations } from '../modules/inventory/application/release-expired-reservations.usecase.js';
import { PrismaStockLedger } from '../modules/inventory/infrastructure/prisma-stock-ledger.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';

export const RESERVATION_SWEEP_JOB_NAME = 'sweep-expired-reservations';
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
    RESERVATION_SWEEP_JOB_NAME,
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: RESERVATION_SWEEP_JOB_NAME },
  );
}

/**
 * Returns a per-job-name handler (not its own Worker) — the `maintenance`
 * queue has more than one logical sweep (this one, plus
 * stored-value-hold-sweep.worker.ts, plan/15 Phase 5) and BullMQ delivers
 * each job to exactly ONE Worker attached to a given queue name, so separate
 * Worker instances on the same queue would COMPETE for jobs rather than each
 * reliably getting its own — same reasoning workers/index.ts's
 * startDomainEventsWorker() documents for DOMAIN_EVENTS_QUEUE. Combined into
 * one Worker there by job name instead.
 */
export function createReservationSweepHandler(): (job: Job) => Promise<void> {
  const releaseExpired = new ReleaseExpiredReservations(new PrismaStockLedger(prisma));
  return async (job: Job) => {
    if (job.name !== RESERVATION_SWEEP_JOB_NAME) return;
    const result = await releaseExpired.execute();
    if (result.releasedCount > 0) {
      logger.info({ releasedCount: result.releasedCount }, 'reservation sweep released expired reservations');
    }
  };
}
