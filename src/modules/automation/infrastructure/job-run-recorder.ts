import type { JobRunLogRepository } from '../domain/repositories.js';

/** Wraps one job handler invocation with a real JobRunLog row — used
 *  directly by each of the 4 existing scheduled-job worker files (a
 *  small, additive wrap around each, not a rewrite). Always re-throws
 *  whatever `fn` throws, so the caller's own existing error handling
 *  (workers/index.ts's per-handler try/catch + logger.error) is
 *  unchanged; this only adds a real, queryable record alongside it. */
export async function recordJobRun(logs: JobRunLogRepository, jobName: string, fn: () => Promise<void>): Promise<void> {
  const id = await logs.recordStart(jobName);
  try {
    await fn();
    await logs.recordFinish(id, 'SUCCEEDED');
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000);
    await logs.recordFinish(id, 'FAILED', message);
    throw err;
  }
}
