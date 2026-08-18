import type { ReferralProgramRepository, ReferralProgramInfo, LoyaltyProgramLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { validateRewardShape } from './validate-reward-shape.js';
import { toReferralProgramView, type WebsiteLookup } from './create-referral-program.usecase.js';
import type { ReferralProgramView, UpdateReferralProgramCommand } from './dto.js';

async function toViewWithWebsiteCode(program: ReferralProgramInfo, websites: WebsiteLookup): Promise<ReferralProgramView> {
  const website = await websites.byId(program.websiteId);
  return toReferralProgramView(program, website?.code ?? '');
}

export class ListReferralPrograms {
  constructor(
    private readonly programs: ReferralProgramRepository,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(): Promise<ReferralProgramView[]> {
    const rows = await this.programs.list();
    return Promise.all(rows.map((r) => toViewWithWebsiteCode(r, this.websites)));
  }
}

export class GetReferralProgram {
  constructor(
    private readonly programs: ReferralProgramRepository,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(publicId: string): Promise<ReferralProgramView> {
    const program = await this.programs.findByPublicId(publicId);
    if (!program) throw new NotFoundError('referral program', publicId);
    return toViewWithWebsiteCode(program, this.websites);
  }
}

/**
 * PATCH re-validates the same reward-shape invariant CreateReferralProgram
 * enforces at creation — but only when the patch actually touches a
 * reward-shape field, merged against the program's current values, so
 * "just rename the program" doesn't force re-supplying every reward field.
 */
export class UpdateReferralProgram {
  constructor(
    private readonly programs: ReferralProgramRepository,
    private readonly loyaltyPrograms: LoyaltyProgramLookup,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(publicId: string, cmd: UpdateReferralProgramCommand): Promise<ReferralProgramView> {
    const program = await this.programs.findByPublicId(publicId);
    if (!program) throw new NotFoundError('referral program', publicId);

    const touchesRewardShape =
      cmd.referrerRewardType !== undefined ||
      cmd.referrerRewardAmount !== undefined ||
      cmd.referrerRewardPoints !== undefined ||
      cmd.refereeRewardType !== undefined ||
      cmd.refereeRewardAmount !== undefined ||
      cmd.refereeRewardPoints !== undefined;

    if (touchesRewardShape) {
      const referrerType = cmd.referrerRewardType ?? program.referrerRewardType;
      const referrerAmount = cmd.referrerRewardAmount !== undefined ? cmd.referrerRewardAmount : program.referrerRewardAmount;
      const referrerPoints = cmd.referrerRewardPoints !== undefined ? cmd.referrerRewardPoints : (program.referrerRewardPoints?.toString() ?? null);
      const refereeType = cmd.refereeRewardType ?? program.refereeRewardType;
      const refereeAmount = cmd.refereeRewardAmount !== undefined ? cmd.refereeRewardAmount : program.refereeRewardAmount;
      const refereePoints = cmd.refereeRewardPoints !== undefined ? cmd.refereeRewardPoints : (program.refereeRewardPoints?.toString() ?? null);
      await validateRewardShape(this.loyaltyPrograms, 'referrer', referrerType, referrerAmount, referrerPoints, program.websiteId);
      await validateRewardShape(this.loyaltyPrograms, 'referee', refereeType, refereeAmount, refereePoints, program.websiteId);
    }

    const updated = await this.programs.update(program.id, {
      name: cmd.name,
      status: cmd.status,
      qualifyingEvent: cmd.qualifyingEvent,
      minOrderAmount: cmd.minOrderAmount,
      referrerRewardType: cmd.referrerRewardType,
      referrerRewardAmount: cmd.referrerRewardAmount,
      referrerRewardPoints: cmd.referrerRewardPoints !== undefined ? (cmd.referrerRewardPoints !== null ? BigInt(cmd.referrerRewardPoints) : null) : undefined,
      refereeRewardType: cmd.refereeRewardType,
      refereeRewardAmount: cmd.refereeRewardAmount,
      refereeRewardPoints: cmd.refereeRewardPoints !== undefined ? (cmd.refereeRewardPoints !== null ? BigInt(cmd.refereeRewardPoints) : null) : undefined,
      maxReferralsPerCustomer: cmd.maxReferralsPerCustomer,
      attributionWindowDays: cmd.attributionWindowDays,
    });
    return toViewWithWebsiteCode(updated, this.websites);
  }
}
