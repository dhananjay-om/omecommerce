import type { ReferralProgramRepository, ReferralProgramInfo, LoyaltyProgramLookup } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { validateRewardShape } from './validate-reward-shape.js';
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

    await validateRewardShape(this.loyaltyPrograms, 'referrer', cmd.referrerRewardType, cmd.referrerRewardAmount, cmd.referrerRewardPoints, website.id);
    await validateRewardShape(this.loyaltyPrograms, 'referee', cmd.refereeRewardType, cmd.refereeRewardAmount, cmd.refereeRewardPoints, website.id);

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
    return toReferralProgramView(program);
  }
}

/** Shared by every usecase that returns a ReferralProgramView (create/get/list/update). */
export function toReferralProgramView(program: ReferralProgramInfo): ReferralProgramView {
  return {
    publicId: program.publicId,
    name: program.name,
    status: program.status,
    qualifyingEvent: program.qualifyingEvent,
    minOrderAmount: program.minOrderAmount,
    referrerRewardType: program.referrerRewardType,
    referrerRewardAmount: program.referrerRewardAmount,
    referrerRewardPoints: program.referrerRewardPoints?.toString() ?? null,
    refereeRewardType: program.refereeRewardType,
    refereeRewardAmount: program.refereeRewardAmount,
    refereeRewardPoints: program.refereeRewardPoints?.toString() ?? null,
    maxReferralsPerCustomer: program.maxReferralsPerCustomer,
    attributionWindowDays: program.attributionWindowDays,
  };
}
