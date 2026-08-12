import type { ReferralProgramRepository, ReferralCodeRepository, ReferralRepository, ReferralRewardRepository, CustomerContextLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { MyReferralsView, ReferralView, ReferralRewardView } from './dto.js';

/** Lazy-creates the caller's own code on first call — same get-or-create pattern as Wallet/LoyaltyAccount. */
export class GetMyReferrals {
  constructor(
    private readonly customerContext: CustomerContextLookup,
    private readonly programs: ReferralProgramRepository,
    private readonly codes: ReferralCodeRepository,
    private readonly referrals: ReferralRepository,
    private readonly rewards: ReferralRewardRepository,
  ) {}

  async execute(customerPublicId: string): Promise<MyReferralsView> {
    const ctx = await this.customerContext.resolveByPublicId(customerPublicId);
    if (!ctx) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const program = await this.programs.findByWebsiteId(ctx.websiteId);
    if (!program) {
      throw new NotFoundError('referral program', 'no program configured for this website');
    }

    let code = await this.codes.findByCustomerAndProgram(ctx.customerId, program.id);
    code ??= await this.codes.create(program.id, ctx.customerId);

    const referrals = await this.referrals.listByReferrer(program.id, ctx.customerId);
    const views: ReferralView[] = [];
    for (const r of referrals) {
      const reward = await this.rewards.findByReferralAndBeneficiary(r.id, 'REFERRER');
      views.push({
        publicId: r.publicId,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        qualifiedAt: r.qualifiedAt?.toISOString() ?? null,
        rewardedAt: r.rewardedAt?.toISOString() ?? null,
        referrerReward: reward ? toRewardView(reward) : null,
      });
    }

    return { code: code.code, referrals: views };
  }
}

function toRewardView(reward: { rewardType: string; amount: string | null; points: bigint | null }): ReferralRewardView {
  return {
    beneficiary: 'REFERRER',
    rewardType: reward.rewardType as ReferralRewardView['rewardType'],
    amount: reward.amount,
    points: reward.points?.toString() ?? null,
  };
}
