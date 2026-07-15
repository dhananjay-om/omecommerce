import type { Redis } from 'ioredis';
import { logger } from '../logger.js';

/**
 * Generic cache-aside helper (plan/09 §3 — "Redis cache-aside behind reads").
 * On a Redis error, logs and falls through to `compute()` rather than failing
 * the request — the cache is an optimization, never a hard dependency for
 * correctness (the DB is always the source of truth).
 */
export class CacheAside {
  constructor(private readonly redis: Redis) {}

  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (err) {
      logger.warn({ err, key }, 'cache read failed, falling through to source');
    }

    const value = await compute();

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, 'cache write failed');
    }
    return value;
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
      const keys: string[] = [];
      for await (const batch of stream) keys.push(...(batch as string[]));
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (err) {
      logger.warn({ err, prefix }, 'cache invalidation failed');
    }
  }
}
