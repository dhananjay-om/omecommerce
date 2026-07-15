import { Queue } from 'bullmq';
import { getQueueConnectionOptions } from './connection.js';

/** Domain events relayed from the outbox (plan/00 §4.8). Job name = eventType. */
export const DOMAIN_EVENTS_QUEUE = 'domain-events';

/** Time-based maintenance jobs (sweepers, cleanup) — not outbox-driven. */
export const MAINTENANCE_QUEUE = 'maintenance';

/** User-triggered async admin jobs (bulk import/export) with per-job status polling (plan/04 §4). */
export const BULK_JOBS_QUEUE = 'bulk-jobs';

let domainEventsQueue: Queue | undefined;
let maintenanceQueue: Queue | undefined;
let bulkJobsQueue: Queue | undefined;

/**
 * No consumer ever polls a domain-event job's result by id after the fact
 * (unlike bulk-jobs, below) — so completed/failed jobs are removed immediately
 * rather than left to accumulate in Redis forever. This also keeps a job's
 * `jobId` (`outbox-<row.id>`) reusable once its outbox row's id cycles back
 * around (e.g. a test DB's `TRUNCATE ... RESTART IDENTITY`) — BullMQ's
 * `queue.add()` is a silent no-op against an existing (even completed/failed)
 * jobId, so leaving old jobs in place would make a new event with a reused id
 * vanish instead of being enqueued.
 */
export function getDomainEventsQueue(): Queue {
  domainEventsQueue ??= new Queue(DOMAIN_EVENTS_QUEUE, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
  });
  return domainEventsQueue;
}

/** Same reasoning as getDomainEventsQueue() above — no consumer polls a maintenance job's result by id. */
export function getMaintenanceQueue(): Queue {
  maintenanceQueue ??= new Queue(MAINTENANCE_QUEUE, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
  });
  return maintenanceQueue;
}

export function getBulkJobsQueue(): Queue {
  bulkJobsQueue ??= new Queue(BULK_JOBS_QUEUE, { connection: getQueueConnectionOptions() });
  return bulkJobsQueue;
}
