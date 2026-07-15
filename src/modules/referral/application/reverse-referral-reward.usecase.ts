import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { LoyaltyLedger } from '../../loyalty/domain/repositories.js';
import type { OrderLookup, ReferralRepository, ReferralRewardRepository, CustomerContextLookup, LoyaltyProgramLookup } from '../domain/repositories.js';
import { toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';

/**
 * Called by the referral-qualify worker on `OrderRefunded`. Only the
 * *referrer's* reward is clawed back — the referee's reward was granted as a
 * conversion incentive at signup, unconditioned on any particular order, so
 * it's never reversed (same asymmetric-clawback reasoning the plan implies).
 * Best-effort like ReverseLoyaltyPoints: floors the clawback at whatever the
 * referrer still has available (STORE_CREDIT) or reverses via the guarded,
 * floor-at-zero LoyaltyLedger.reverseUpTo (POINTS) — a refund must never fail
 * because a reward was already spent.
 */
export class ReverseReferralReward {
  constructor(
    private readonly orders: OrderLookup,
    private readonly referrals: ReferralRepository,
    private readonly rewards: ReferralRewardRepository,
    private readonly wallets: WalletLedger,
    private readonly loyaltyLedger: LoyaltyLedger,
    private readonly loyaltyPrograms: LoyaltyProgramLookup,
    private readonly customerContext: CustomerContextLookup,
  ) {}

  async execute(orderPublicId: string): Promise<void> {
    const order = await this.orders.byPublicId(orderPublicId);
    if (!order) return;

    const referral = await this.referrals.findByQualifyingOrderId(order.id);
    if (!referral || referral.status !== 'REWARDED') return;

    const reward = await this.rewards.findByReferralAndBeneficiary(referral.id, 'REFERRER');
    if (!reward) return;

    const ctx = await this.customerContext.resolveByCustomerId(referral.referrerCustomerId);
    if (!ctx) return;

    if (reward.rewardType === 'STORE_CREDIT' && reward.amount) {
      const wallet = await this.wallets.findByCustomerId(referral.referrerCustomerId);
      if (wallet) {
        const clawback = minDecimal(reward.amount, wallet.balance);
        if (toMinorUnits(clawback) > 0n) {
          try {
            await this.wallets.debit(wallet.id, clawback, 'STORE_CREDIT', 'REFERRAL', {
              txnType: 'ADJUST',
              refType: 'Referral',
              refId: referral.id,
              idempotencyKey: `referral-reward-reverse-${referral.id}`,
              reason: `Referral reward clawback: order ${orderPublicId} refunded`,
            });
          } catch {
            // Balance changed between our read and the debit (race) — best
            // effort, same as ReverseLoyaltyPoints; skip rather than fail
            // the refund flow.
          }
        }
      }
    } else if (reward.rewardType === 'POINTS' && reward.points) {
      const loyaltyProgram = await this.loyaltyPrograms.findByWebsiteId(ctx.websiteId);
      if (loyaltyProgram) {
        const account = await this.loyaltyLedger.findByCustomerAndProgram(referral.referrerCustomerId, loyaltyProgram.id);
        if (account) {
          await this.loyaltyLedger.reverseUpTo(account.id, reward.points, 'REVERSAL', {
            refType: 'Referral',
            refId: referral.id,
            idempotencyKey: `referral-reward-reverse-${referral.id}`,
            reason: `Referral reward clawback: order ${orderPublicId} refunded`,
          });
        }
      }
    }

    await this.referrals.markReversed(referral.id);
  }
}

function minDecimal(a: string, b: string): string {
  return toMinorUnits(a) < toMinorUnits(b) ? a : fromMinorUnits(toMinorUnits(b));
}
