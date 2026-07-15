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

export function getDomainEventsQueue(): Queue {
  domainEventsQueue ??= new Queue(DOMAIN_EVENTS_QUEUE, { connection: getQueueConnectionOptions() });
  return domainEventsQueue;
}

export function getMaintenanceQueue(): Queue {
  maintenanceQueue ??= new Queue(MAINTENANCE_QUEUE, { connection: getQueueConnectionOptions() });
  return maintenanceQueue;
}

export function getBulkJobsQueue(): Queue {
  bulkJobsQueue ??= new Queue(BULK_JOBS_QUEUE, { connection: getQueueConnectionOptions() });
  return bulkJobsQueue;
}
