import type { OrderLookup, ReferralProgramRepository, ReferralRepository } from '../domain/repositories.js';
import { IssueReferralReward } from './issue-referral-reward.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';

/**
 * Called by the referral-qualify worker on `OrderPaid` (plan/11 §3.2 step 4).
 * Only meaningful for FIRST_ORDER-qualifying programs — a SIGNUP-qualifying
 * program already rewarded the referrer at attach time. Silently no-ops for
 * guest orders, non-referee customers, and orders below `minOrderAmount`
 * (the referral stays SIGNED_UP — a *later* order can still qualify, matching
 * the plan's "first order >= min spend" wording, not "the literal first
 * order or nothing").
 */
export class QualifyReferral {
  constructor(
    private readonly orders: OrderLookup,
    private readonly programs: ReferralProgramRepository,
    private readonly referrals: ReferralRepository,
    private readonly issueReward: IssueReferralReward,
  ) {}

  async execute(orderPublicId: string): Promise<void> {
    const order = await this.orders.byPublicId(orderPublicId);
    if (!order || !order.customerId) return;

    const program = await this.programs.findByWebsiteId(order.websiteId);
    if (!program || program.status !== 'ACTIVE' || program.qualifyingEvent !== 'FIRST_ORDER') return;

    const referral = await this.referrals.findByProgramAndReferee(program.id, order.customerId);
    if (!referral || referral.status !== 'SIGNED_UP') return;

    if (program.attributionWindowDays != null) {
      const deadline = referral.createdAt.getTime() + program.attributionWindowDays * 86_400_000;
      if (Date.now() > deadline) {
        await this.referrals.markExpired(referral.id);
        return;
      }
    }

    if (program.minOrderAmount != null && toMinorUnits(order.grandTotal) < toMinorUnits(program.minOrderAmount)) {
      return;
    }

    const qualified = await this.referrals.markQualified(referral.id, order.id);
    await this.issueReward.execute(qualified, 'REFERRER', program);
    await this.referrals.markRewarded(referral.id);
  }
}
