import type { ReferralRewardType } from '@prisma/client';
import type { ReferralProgramRepository, ReferralProgramInfo, LoyaltyProgramLookup } from '../domain/repositories.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';
import type { CreateReferralProgramCommand, ReferralProgramView } from './dto.js';

export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
}

export class CreateReferralProgram {
  constructor(
    private readonly programs: ReferralProgramRepository,
    private readonly websites: WebsiteLookup,
    private readonly loyaltyPrograms: LoyaltyProgramLookup,
  ) {}

  async execute(cmd: CreateReferralProgramCommand, actorId?: bigint): Promise<ReferralProgramView> {
    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) {
      throw new NotFoundError('website', cmd.websiteCode);
    }
    if (await this.programs.findByWebsiteId(website.id)) {
      throw new ConflictError(`a referral program already exists for this website: ${cmd.websiteCode}`);
    }

    await this.validateRewardShape('referrer', cmd.referrerRewardType, cmd.referrerRewardAmount, cmd.referrerRewardPoints, website.id);
    await this.validateRewardShape('referee', cmd.refereeRewardType, cmd.refereeRewardAmount, cmd.refereeRewardPoints, website.id);

    const program = await this.programs.create({
      websiteId: website.id,
      name: cmd.name,
      qualifyingEvent: cmd.qualifyingEvent,
      minOrderAmount: cmd.minOrderAmount,
      referrerRewardType: cmd.referrerRewardType,
      referrerRewardAmount: cmd.referrerRewardAmount,
      referrerRewardPoints: cmd.referrerRewardPoints !== undefined ? BigInt(cmd.referrerRewardPoints) : undefined,
      refereeRewardType: cmd.refereeRewardType,
      refereeRewardAmount: cmd.refereeRewardAmount,
      refereeRewardPoints: cmd.refereeRewardPoints !== undefined ? BigInt(cmd.refereeRewardPoints) : undefined,
      maxReferralsPerCustomer: cmd.maxReferralsPerCustomer,
      attributionWindowDays: cmd.attributionWindowDays,
      createdBy: actorId,
    });
    return toView(program);
  }

  /**
   * Exactly one of amount/points must be given, matching the declared reward
   * type, and it must be strictly positive — a configured reward of zero
   * would pass this check but then fail the DB's own `referral_reward_shape`
   * CHECK at the first actual issuance, so it's rejected here instead. A
   * POINTS type additionally requires a Loyalty program to already exist for
   * the website (see issue-referral-reward.ts's header comment on why this
   * is validated here, not at issuance time).
   */
  private async validateRewardShape(
    side: 'referrer' | 'referee',
    type: ReferralRewardType,
    amount: string | undefined,
    points: string | undefined,
    websiteId: bigint,
  ): Promise<void> {
    if (type === 'STORE_CREDIT') {
      if (!amount || toMinorUnits(amount) <= 0n) {
        throw new ValidationError(`${side}RewardAmount must be a positive amount when ${side}RewardType is STORE_CREDIT`, [
          { path: `${side}RewardAmount`, message: 'required, positive' },
        ]);
      }
    } else {
      if (!points || BigInt(points) <= 0n) {
        throw new ValidationError(`${side}RewardPoints must be a positive integer when ${side}RewardType is POINTS`, [
          { path: `${side}RewardPoints`, message: 'required, positive' },
        ]);
      }
      if (!(await this.loyaltyPrograms.findByWebsiteId(websiteId))) {
        throw new ValidationError(`a Loyalty program must exist for this website before configuring a POINTS referral reward`, [
          { path: `${side}RewardType`, message: 'no Loyalty program configured for this website' },
        ]);
      }
    }
  }
}

function toView(program: ReferralProgramInfo): ReferralProgramView {
  return {
    publicId: program.publicId,
    name: program.name,
    qualifyingEvent: program.qualifyingEvent,
    referrerRewardType: program.referrerRewardType,
    refereeRewardType: program.refereeRewardType,
  };
}
