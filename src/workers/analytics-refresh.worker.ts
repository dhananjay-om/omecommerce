import type { Job } from 'bullmq';
import { getMaintenanceQueue } from '../shared/infrastructure/queue/queues.js';
import { createAnalyticsRefreshDeps } from '../modules/analytics/analytics.module.js';
import { yesterdayDateKey } from '../modules/analytics/domain/date-key.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';

export const ANALYTICS_REFRESH_JOB_NAME = 'analytics-nightly-refresh';
// 02:15 UTC — after midnight so "yesterday" is a fully closed day everywhere,
// and offset from :00 to avoid piling onto whatever else runs on the hour.
const NIGHTLY_CRON = '15 2 * * *';

/** Schedules the nightly analytics refresh as a real repeatable BullMQ job —
 *  same `queue.add(name, {}, { repeat, jobId })` pattern as
 *  reservation-sweep.worker.ts's scheduleReservationSweep(), just on a cron
 *  `pattern` instead of a fixed `every` interval (this job runs once a day,
 *  not once a minute). */
export async function scheduleAnalyticsRefresh(): Promise<void> {
  const queue = getMaintenanceQueue();
  await queue.add(ANALYTICS_REFRESH_JOB_NAME, {}, { repeat: { pattern: NIGHTLY_CRON }, jobId: ANALYTICS_REFRESH_JOB_NAME });
}

/** Per-job-name handler for the shared `maintenance` Worker (see
 *  workers/index.ts's startMaintenanceWorker() — same "one Worker per queue
 *  name" reasoning as every other maintenance sweep). Recomputes every
 *  active website's summary buckets for the day that just closed (plan/19
 *  §11's "catch-up/self-healing pass" — the same RefreshWebsiteDay code
 *  path the event-driven projector uses, so it can never drift from it),
 *  snapshots inventory, recomputes RFM, reconciles, then evaluates alert
 *  rules against the now-fresh data — in that order, since alerts must
 *  read numbers that are already correct for the day, not stale ones. */
export function createAnalyticsRefreshHandler(): (job: Job) => Promise<void> {
  const { runNightlyRefresh, evaluateAlertRules } = createAnalyticsRefreshDeps(prisma);

  return async (job: Job) => {
    if (job.name !== ANALYTICS_REFRESH_JOB_NAME) return;
    const now = new Date();
    const dateKey = yesterdayDateKey(now);
    try {
      await runNightlyRefresh.execute(dateKey);
      logger.info({ dateKey }, 'analytics nightly refresh completed');
    } catch (err) {
      logger.error({ err, dateKey }, 'analytics nightly refresh failed');
      return; // don't evaluate alerts against a refresh that may not have completed
    }
    try {
      await evaluateAlertRules.execute(now);
    } catch (err) {
      logger.error({ err, dateKey }, 'analytics alert evaluation failed');
    }
  };
}
