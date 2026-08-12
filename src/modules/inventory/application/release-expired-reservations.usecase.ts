import type { StockLedger } from '../domain/repositories.js';

/**
 * Sweeper logic (plan/07 §3): expires ACTIVE reservations past their expiresAt.
 * Not yet wired to a scheduler — BullMQ cron integration is Stage 3 (plan/12 §5).
 * Exposed as a use-case + admin-triggered endpoint so the logic is provably correct
 * ahead of that wiring.
 */
export class ReleaseExpiredReservations {
  constructor(private readonly ledger: StockLedger) {}

  async execute(now: Date = new Date()): Promise<{ releasedCount: number }> {
    const releasedCount = await this.ledger.releaseExpired(now);
    return { releasedCount };
  }
}
