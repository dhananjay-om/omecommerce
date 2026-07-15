import type { ReferralProgramRepository, ReferralCodeRepository, ReferralRepository, CustomerContextLookup, ReferralInfo } from '../domain/repositories.js';
import { IssueReferralReward } from './issue-referral-reward.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import { ReferralCodeInvalidError, SelfReferralError, MaxReferralsExceededError } from '../domain/errors.js';
import type { AttachReferralResult, ReferralRewardView } from './dto.js';

/**
 * Called once, shortly after a customer registers (this pass has no
 * pre-signup click/attribution tracking — see referral.prisma's header — so
 * a referral is only ever created with a known referee, at attach time, not
 * at click time). Issues the referee's reward immediately (matches plan §3.2:
 * "referee reward often granted at signup"); for a SIGNUP-qualifying
 * program, also qualifies and rewards the referrer in the same call.
 */
export class AttachReferral {
  constructor(
    private readonly customerContext: CustomerContextLookup,
    private readonly codes: ReferralCodeRepository,
    private readonly programs: ReferralProgramRepository,
    private readonly referrals: ReferralRepository,
    private readonly issueReward: IssueReferralReward,
  ) {}

  async execute(customerPublicId: string, code: string): Promise<AttachReferralResult> {
    const ctx = await this.customerContext.resolveByPublicId(customerPublicId);
    if (!ctx) {
      throw new NotFoundError('customer', customerPublicId);
    }

    const referralCode = await this.codes.findByCode(code);
    if (!referralCode) {
      throw new ReferralCodeInvalidError(code);
    }

    const program = await this.programs.findById(referralCode.programId);
    if (!program || program.status !== 'ACTIVE') {
      throw new ReferralCodeInvalidError(code);
    }

    if (referralCode.customerId === ctx.customerId) {
      throw new SelfReferralError();
    }

    if (program.maxReferralsPerCustomer != null) {
      const count = await this.referrals.countByReferrer(program.id, referralCode.customerId);
      if (count >= program.maxReferralsPerCustomer) {
        throw new MaxReferralsExceededError(program.maxReferralsPerCustomer);
      }
    }

    if (await this.referrals.findByProgramAndReferee(program.id, ctx.customerId)) {
      throw new ConflictError('a referral has already been attached for this customer');
    }

    let referral: ReferralInfo = await this.referrals.create({
      programId: program.id,
      referralCodeId: referralCode.id,
      referrerCustomerId: referralCode.customerId,
      refereeCustomerId: ctx.customerId,
    });
    await this.codes.incrementUses(referralCode.id);

    const refereeReward = await this.issueReward.execute(referral, 'REFEREE', program);

    if (program.qualifyingEvent === 'SIGNUP') {
      referral = await this.referrals.markQualified(referral.id, null);
      await this.issueReward.execute(referral, 'REFERRER', program);
      referral = await this.referrals.markRewarded(referral.id);
    }

    return {
      referralPublicId: referral.publicId,
      status: referral.status,
      refereeReward: toRewardView(refereeReward),
    };
  }
}

function toRewardView(reward: { rewardType: string; amount: string | null; points: bigint | null }): ReferralRewardView {
  return {
    beneficiary: 'REFEREE',
    rewardType: reward.rewardType as ReferralRewardView['rewardType'],
    amount: reward.amount,
    points: reward.points?.toString() ?? null,
  };
}
