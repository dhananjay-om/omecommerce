import type { Job } from 'bullmq';
import { getMaintenanceQueue } from '../shared/infrastructure/queue/queues.js';
import { createAiRefreshDeps } from '../modules/ai/ai.module.js';
import { yesterdayDateKey } from '../modules/analytics/domain/date-key.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';

export const AI_REFRESH_JOB_NAME = 'ai-insights-nightly-refresh';
// 02:30 UTC — 15 minutes after analytics-refresh.worker.ts's own 02:15 UTC
// nightly job, so the rule engine reads that day's already-fresh summary
// tables, not stale ones (the AI Insights rules read AnalyticsQueryRepository
// directly, not raw order data).
const NIGHTLY_CRON = '30 2 * * *';

/** Schedules the nightly AI Insights refresh — same
 *  `queue.add(name, {}, { repeat, jobId })` pattern as every other scheduled
 *  job in this codebase (analytics-refresh.worker.ts's own
 *  scheduleAnalyticsRefresh being the closest precedent). */
export async function scheduleAiRefresh(): Promise<void> {
  const queue = getMaintenanceQueue();
  await queue.add(AI_REFRESH_JOB_NAME, {}, { repeat: { pattern: NIGHTLY_CRON }, jobId: AI_REFRESH_JOB_NAME });
}

/** Per-job-name handler for the shared `maintenance` Worker (workers/
 *  index.ts's startMaintenanceWorker()). Regenerates every website's AI
 *  Insights for the day that just closed. No event-driven projector
 *  alongside this (unlike analytics-projector.worker.ts) — a trailing-7-day
 *  trend insight doesn't need real-time updates the way "today's order
 *  count" does; nightly is the right cadence for this kind of report. */
export function createAiRefreshHandler(): (job: Job) => Promise<void> {
  const { runNightlyAiRefresh } = createAiRefreshDeps(prisma);

  return async (job: Job) => {
    if (job.name !== AI_REFRESH_JOB_NAME) return;
    const dateKey = yesterdayDateKey(new Date());
    try {
      await runNightlyAiRefresh.execute(dateKey);
      logger.info({ dateKey }, 'AI insights nightly refresh completed');
    } catch (err) {
      logger.error({ err, dateKey }, 'AI insights nightly refresh failed');
    }
  };
}
