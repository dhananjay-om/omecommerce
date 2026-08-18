import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { GiftCardLedger } from '../../giftcard/domain/repositories.js';

/**
 * The stored-value counterpart to inventory's ReleaseExpiredReservations
 * (plan/15 Phase 5) — swept by stored-value-hold-sweep.worker.ts, same
 * BullMQ repeatable-job shape as reservation-sweep.worker.ts. Two calls, not
 * one, because HELD holds for wallet vs gift card live in the same
 * stored_value_hold table but are owned by two different ledgers (the same
 * module-boundary split CompleteCheckout's own hold-placement loop uses).
 */
export class ReleaseExpiredStoredValueHolds {
  constructor(
    private readonly wallets: WalletLedger,
    private readonly giftCards: GiftCardLedger,
  ) {}

  async execute(now: Date = new Date()): Promise<{ releasedCount: number }> {
    const [walletCount, giftCardCount] = await Promise.all([this.wallets.releaseExpiredHolds(now), this.giftCards.releaseExpiredHolds(now)]);
    return { releasedCount: walletCount + giftCardCount };
  }
}
