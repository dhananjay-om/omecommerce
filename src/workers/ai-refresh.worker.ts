import type { Job } from 'bullmq';
import { getMaintenanceQueue } from '../shared/infrastructure/queue/queues.js';
import { createAiRefreshDeps } from '../modules/ai/ai.module.js';
import { yesterdayDateKey } from '../modules/analytics/domain/date-key.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { logger } from '../shared/infrastructure/logger.js';
import { createJobRunLogRepository } from '../modules/automation/automation.module.js';
import { recordJobRun } from '../modules/automation/infrastructure/job-run-recorder.js';

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
 *  Insights, then Product Forecasts, then Merchandising Suggestions, for the
 *  day that just closed — same one-job-does-several-related-things shape as
 *  analytics' RunNightlyRefresh (order summaries + fulfillment + inventory
 *  snapshot + RFM, all in one nightly pass), not a second cron registration
 *  per table. No event-driven projector alongside this (unlike
 *  analytics-projector.worker.ts) — a trailing-window trend/forecast
 *  doesn't need real-time updates the way "today's order count" does;
 *  nightly is the right cadence for all three. Each step is wrapped
 *  independently so one failing doesn't block the others — EXCEPT
 *  Suggestions must still run last: 2 of its 3 kinds read Forecasts' own
 *  freshly-written output, so ordering (not just independence) matters here. */
export function createAiRefreshHandler(): (job: Job) => Promise<void> {
  const { runNightlyAiRefresh, runNightlyForecastRefresh, runNightlySuggestionRefresh } = createAiRefreshDeps(prisma);
  const jobRunLogs = createJobRunLogRepository(prisma);

  return async (job: Job) => {
    if (job.name !== AI_REFRESH_JOB_NAME) return;
    const dateKey = yesterdayDateKey(new Date());
    // Wrapped in recordJobRun (Scheduled Jobs' own run-history table).
    // Each of the 3 steps still runs independently exactly as before
    // (one failing doesn't block the others) — errors are just collected
    // instead of only logged, so a real failure in any step still shows
    // up as FAILED in that history, not silently as SUCCEEDED.
    await recordJobRun(jobRunLogs, AI_REFRESH_JOB_NAME, async () => {
      const errors: unknown[] = [];
      try {
        await runNightlyAiRefresh.execute(dateKey);
        logger.info({ dateKey }, 'AI insights nightly refresh completed');
      } catch (err) {
        logger.error({ err, dateKey }, 'AI insights nightly refresh failed');
        errors.push(err);
      }
      try {
        await runNightlyForecastRefresh.execute(dateKey);
        logger.info({ dateKey }, 'product forecast nightly refresh completed');
      } catch (err) {
        logger.error({ err, dateKey }, 'product forecast nightly refresh failed');
        errors.push(err);
      }
      try {
        await runNightlySuggestionRefresh.execute(dateKey);
        logger.info({ dateKey }, 'merchandising suggestion nightly refresh completed');
      } catch (err) {
        logger.error({ err, dateKey }, 'merchandising suggestion nightly refresh failed');
        errors.push(err);
      }
      if (errors.length > 0) {
        throw new Error(`${errors.length} of 3 AI refresh steps failed: ${errors.map((e) => (e instanceof Error ? e.message : String(e))).join('; ')}`);
      }
    });
  };
}
