import { Queue } from 'bullmq';
import { getQueueConnectionOptions } from './connection.js';

/** Domain events relayed from the outbox (plan/00 §4.8). Job name = eventType. */
export const DOMAIN_EVENTS_QUEUE = 'domain-events';

/** Time-based maintenance jobs (sweepers, cleanup) — not outbox-driven. */
export const MAINTENANCE_QUEUE = 'maintenance';

let domainEventsQueue: Queue | undefined;
let maintenanceQueue: Queue | undefined;

export function getDomainEventsQueue(): Queue {
  domainEventsQueue ??= new Queue(DOMAIN_EVENTS_QUEUE, { connection: getQueueConnectionOptions() });
  return domainEventsQueue;
}

export function getMaintenanceQueue(): Queue {
  maintenanceQueue ??= new Queue(MAINTENANCE_QUEUE, { connection: getQueueConnectionOptions() });
  return maintenanceQueue;
}
