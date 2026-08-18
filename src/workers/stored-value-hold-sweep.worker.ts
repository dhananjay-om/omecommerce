import type { Job } from 'bullmq';
import { getMaintenanceQueue } from '../shared/infrastructure/queue/queues.js';
import { ReleaseExpiredStoredValueHolds } from '../modules/order/application/release-expired-stored-value-holds.usecase.js';
import { PrismaWalletLedger } from '../modules/wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaGiftCardLedger } from '../modules/giftcard/infrastructure/prisma-giftcard-ledger.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';

export const STORED_VALUE_HOLD_SWEEP_JOB_NAME = 'sweep-expired-stored-value-holds';
const SWEEP_INTERVAL_MS = 60_000; // every minute — same cadence as reservation-sweep.worker.ts

/** Schedules the checkout-tender-hold-expiry sweep as a real repeatable BullMQ job (plan/15 Phase 5) — same shape as reservation-sweep.worker.ts. */
export async function scheduleStoredValueHoldSweep(): Promise<void> {
  const queue = getMaintenanceQueue();
  await queue.add(
    STORED_VALUE_HOLD_SWEEP_JOB_NAME,
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: STORED_VALUE_HOLD_SWEEP_JOB_NAME },
  );
}

/** Returns a per-job-name handler, combined into the shared `maintenance` queue Worker in workers/index.ts — see reservation-sweep.worker.ts's identical doc comment for why this isn't its own Worker. */
export function createStoredValueHoldSweepHandler(): (job: Job) => Promise<void> {
  const releaseExpired = new ReleaseExpiredStoredValueHolds(new PrismaWalletLedger(prisma), new PrismaGiftCardLedger(prisma));
  return async (job: Job) => {
    if (job.name !== STORED_VALUE_HOLD_SWEEP_JOB_NAME) return;
    const result = await releaseExpired.execute();
    if (result.releasedCount > 0) {
      logger.info({ releasedCount: result.releasedCount }, 'stored-value hold sweep released expired holds');
    }
  };
}
