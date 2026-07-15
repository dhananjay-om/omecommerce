import { createHash } from 'node:crypto';
import type { Db } from '../prisma/client.js';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const STALE_IN_PROGRESS_MS = 60 * 1000; // reclaim a crashed request's claim after 60s

export type ClaimResult =
  | { outcome: 'proceed' }
  | { outcome: 'replay'; status: number; body: unknown }
  | { outcome: 'conflict' }
  | { outcome: 'in_progress' };

interface KeyRow {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
}

export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

/**
 * Idempotency-Key handling (plan/00 §4.8). This is a CLAIM/COMPLETE state
 * machine, not a response cache: `claim` atomically INSERTs an IN_PROGRESS row
 * via the (route,key) unique constraint BEFORE the handler runs, so a
 * concurrent duplicate request (double-click, retried delivery) hits the unique
 * violation immediately and is told to back off — it never reaches the handler.
 * See prisma/schema/system.prisma header and the db-migration-verifier proof
 * (10 concurrent claims on one key: exactly 1 succeeds).
 */
export class IdempotencyService {
  constructor(private readonly db: Db) {}

  async claim(route: string, key: string, requestHash: string): Promise<ClaimResult> {
    const expiresAt = new Date(Date.now() + TTL_MS);
    const inserted = await this.db.$queryRaw<Array<{ id: bigint }>>`
      INSERT INTO idempotency_key (route, key, request_hash, status, expires_at)
      VALUES (${route}, ${key}, ${requestHash}, 'IN_PROGRESS', ${expiresAt})
      ON CONFLICT (route, key) DO NOTHING
      RETURNING id`;
    if (inserted.length > 0) return { outcome: 'proceed' };

    const rows = await this.db.$queryRaw<KeyRow[]>`
      SELECT status, request_hash, response_status, response_body
      FROM idempotency_key WHERE route = ${route} AND key = ${key}`;
    const existing = rows[0];
    if (!existing) return { outcome: 'proceed' }; // raced with a delete/expiry sweep; safe to retry claim next call

    if (existing.status === 'COMPLETED') {
      if (existing.request_hash !== requestHash) return { outcome: 'conflict' };
      return { outcome: 'replay', status: existing.response_status!, body: existing.response_body };
    }

    if (existing.status === 'FAILED') {
      const reclaimed = await this.db.$executeRaw`
        UPDATE idempotency_key SET status = 'IN_PROGRESS', request_hash = ${requestHash}
         WHERE route = ${route} AND key = ${key} AND status = 'FAILED'`;
      return reclaimed > 0 ? { outcome: 'proceed' } : { outcome: 'in_progress' };
    }

    // IN_PROGRESS: reclaim only if stale (the original request crashed mid-flight).
    const staleBefore = new Date(Date.now() - STALE_IN_PROGRESS_MS);
    const reclaimed = await this.db.$executeRaw`
      UPDATE idempotency_key SET request_hash = ${requestHash}
       WHERE route = ${route} AND key = ${key} AND status = 'IN_PROGRESS' AND updated_at < ${staleBefore}`;
    return reclaimed > 0 ? { outcome: 'proceed' } : { outcome: 'in_progress' };
  }

  async complete(route: string, key: string, status: number, body: unknown): Promise<void> {
    await this.db.$executeRaw`
      UPDATE idempotency_key
         SET status = 'COMPLETED', response_status = ${status}, response_body = ${JSON.stringify(body)}::jsonb
       WHERE route = ${route} AND key = ${key}`;
  }

  async fail(route: string, key: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE idempotency_key SET status = 'FAILED' WHERE route = ${route} AND key = ${key}`;
  }
}
