import type { Queue } from 'bullmq';
import type { Db } from '../prisma/client.js';
import { logger } from '../logger.js';

interface OutboxRow {
  id: bigint;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
}

/**
 * Relays unpublished outbox rows to BullMQ (plan/00 §4.8). Uses
 * `FOR UPDATE SKIP LOCKED` so multiple relay instances (horizontal scaling,
 * plan/09) can run concurrently without double-processing the same rows.
 * Marks a row published only AFTER its enqueue succeeds — a crash between
 * enqueue and the UPDATE just means the row is re-enqueued on the next poll
 * (harmless: BullMQ's `jobId` dedupes, and consumers are idempotent), whereas
 * marking published first would risk silently losing an event on a crash.
 */
export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly db: Db,
    private readonly queue: Queue,
    private readonly intervalMs: number = 2000,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      this.pollOnce().catch((err) => logger.error({ err }, 'outbox relay poll failed'));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Exposed for tests: runs a single poll cycle and returns rows relayed. */
  async pollOnce(): Promise<number> {
    if (this.polling) return 0; // avoid overlapping polls from the same instance
    this.polling = true;
    try {
      return await this.db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id, aggregate_type, aggregate_id, event_type, payload
          FROM outbox_event
          WHERE published_at IS NULL
          ORDER BY id
          LIMIT 100
          FOR UPDATE SKIP LOCKED`;

        for (const row of rows) {
          await this.queue.add(
            row.event_type,
            {
              aggregateType: row.aggregate_type,
              aggregateId: row.aggregate_id,
              eventType: row.event_type,
              payload: row.payload,
            },
            { jobId: `outbox-${row.id}` },
          );
          await tx.$executeRaw`UPDATE outbox_event SET published_at = now() WHERE id = ${row.id}`;
        }
        return rows.length;
      });
    } finally {
      this.polling = false;
    }
  }
}
