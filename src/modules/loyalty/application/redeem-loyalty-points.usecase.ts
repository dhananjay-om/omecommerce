import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { LoyaltyLedger, LoyaltyProgramRepository, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { fromMinorUnits, toMinorUnits, applyRate } from '../../../shared/domain/decimal.js';
import type { RedeemLoyaltyPointsResult } from './dto.js';

/**
 * The self-contained "redeem points as store credit" path (plan/11 §2.3,
 * "converts into a concrete instrument so the order/refund math stays in
 * dollars") — no checkout dependency. Reuses WalletLedger directly
 * (correctness-critical ledger logic, not duplicated) — same cross-module
 * reuse pattern as RedeemGiftCardIntoWallet reusing it, and as Order reusing
 * Inventory's StockLedger/Pricing's PriceResolver.
 *
 * Two separate atomic operations (redeem points, then credit wallet), not one
 * cross-table transaction — same saga/compensation precedent as
 * RedeemGiftCardIntoWallet/CompleteCheckout: if the wallet credit fails after
 * points were debited, the points are credited back (a compensating earn),
 * never silently lost.
 */
export class RedeemLoyaltyPoints {
  constructor(
    private readonly ledger: LoyaltyLedger,
    private readonly programs: LoyaltyProgramRepository,
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerContextLookup,
  ) {}

  async execute(customerPublicId: string, points: string): Promise<RedeemLoyaltyPointsResult> {
    const ctx = await this.customers.resolveByPublicId(customerPublicId);
    if (!ctx) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const program = await this.programs.findByWebsiteId(ctx.websiteId);
    if (!program) {
      throw new NotFoundError('loyalty program', 'no program configured for this website');
    }
    if (!/^\d+$/.test(points)) {
      throw new ValidationError('invalid points', [{ path: 'points', message: 'expected a non-negative integer' }]);
    }
    const pointsToRedeem = BigInt(points);
    if (pointsToRedeem < BigInt(program.redeemMinPoints)) {
      throw new ValidationError(`must redeem at least ${program.redeemMinPoints} points`, [
        { path: 'points', message: `minimum ${program.redeemMinPoints}` },
      ]);
    }

    const account = await this.ledger.getOrCreateAccount(ctx.customerId, program.id);
    await this.ledger.redeem(account.id, pointsToRedeem, 'CUSTOMER', { reason: 'Redeemed for store credit' });

    // storeCreditAmount = points * program.pointValue (both scale-4 after minor-unit conversion).
    const pointsAsMinor = pointsToRedeem * 10_000n; // treat the whole-number point count as a scale-4 amount for applyRate
    const storeCreditMinor = applyRate(pointsAsMinor, toMinorUnits(program.pointValue));
    const storeCreditAmount = fromMinorUnits(storeCreditMinor);

    try {
      const wallet = await this.wallets.getOrCreateWallet(ctx.customerId, ctx.websiteId, ctx.currency);
      const walletSnapshot = await this.wallets.credit(wallet.id, storeCreditAmount, 'LOYALTY_CONVERSION', 'LOYALTY', {
        refType: 'LoyaltyAccount',
        refId: account.id,
        reason: `${points} points redeemed as store credit`,
      });
      return { redeemedPoints: points, storeCreditAmount, walletBalance: walletSnapshot.balance };
    } catch (err) {
      // Compensate: credit the points back — same saga pattern as
      // RedeemGiftCardIntoWallet's compensating reversal.
      await this.ledger.earn(account.id, pointsToRedeem, 'CUSTOMER', { reason: 'compensating reversal: wallet credit failed' });
      throw err;
    }
  }
}
