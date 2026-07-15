import type { ConnectionOptions } from 'bullmq';
import { env } from '../../../config/env.js';

/**
 * BullMQ bundles its own internal `ioredis` copy, which is a nominally distinct
 * class from the top-level `ioredis` package this app otherwise uses (redis/
 * client.ts) — passing a constructed `ioredis.Redis` instance across that
 * boundary is a TypeScript class-identity mismatch (and, per BullMQ's docs, a
 * real footgun even in JS: BullMQ needs `maxRetriesPerRequest: null` and full
 * control over the connection lifecycle). Passing plain connection options
 * instead sidesteps this entirely and lets BullMQ manage its own connections.
 */
export function getQueueConnectionOptions(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
