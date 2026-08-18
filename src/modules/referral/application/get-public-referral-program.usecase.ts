import type { ReferralProgramRepository } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { PublicReferralProgramView } from './dto.js';

/**
 * Public, unauthenticated read for the storefront referral page — states
 * the offer terms so a shopper knows what they and their friend get before
 * sharing their link (plan/15 Phase 4). Resolved by storeViewId, matching
 * GetPublicLoyaltyProgram and every other public store-scoped read. Returns
 * 404 when there's no program for this website, or it exists but isn't
 * ACTIVE — a paused/ended program has nothing to advertise.
 */
export class GetPublicReferralProgram {
  constructor(
    private readonly programs: ReferralProgramRepository,
    private readonly storeContext: StoreContextResolver,
  ) {}

  async execute(storeViewId: bigint): Promise<PublicReferralProgramView> {
    const ctx = await this.storeContext.byStoreViewId(storeViewId);
    if (!ctx) throw new NotFoundError('StoreView', storeViewId.toString());

    const program = await this.programs.findByWebsiteId(ctx.websiteId);
    if (!program || program.status !== 'ACTIVE') throw new NotFoundError('referral program', ctx.websiteId.toString());

    return {
      name: program.name,
      qualifyingEvent: program.qualifyingEvent,
      minOrderAmount: program.minOrderAmount,
      referrerRewardType: program.referrerRewardType,
      referrerRewardAmount: program.referrerRewardAmount,
      referrerRewardPoints: program.referrerRewardPoints?.toString() ?? null,
      refereeRewardType: program.refereeRewardType,
      refereeRewardAmount: program.refereeRewardAmount,
      refereeRewardPoints: program.refereeRewardPoints?.toString() ?? null,
      maxReferralsPerCustomer: program.maxReferralsPerCustomer,
    };
  }
}
