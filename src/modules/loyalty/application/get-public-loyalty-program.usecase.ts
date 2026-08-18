import type { LoyaltyProgramRepository, LoyaltyTierRepository } from '../domain/repositories.js';
import type { StoreContextResolver } from '../../../shared/application/scope.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { PublicLoyaltyProgramView } from './dto.js';

/**
 * Public, unauthenticated read for the storefront rewards page — "N points
 * to next tier" and the program's terms (plan/15 Phase 4). Resolved by
 * storeViewId, not websiteCode, matching every other public store-scoped
 * read (CMS, PDP) rather than introducing a new resolution convention.
 * Returns 404 when there's no program for this website, or it exists but
 * isn't ACTIVE — a paused/ended program has nothing to advertise.
 */
export class GetPublicLoyaltyProgram {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
    private readonly storeContext: StoreContextResolver,
  ) {}

  async execute(storeViewId: bigint): Promise<PublicLoyaltyProgramView> {
    const ctx = await this.storeContext.byStoreViewId(storeViewId);
    if (!ctx) throw new NotFoundError('StoreView', storeViewId.toString());

    const program = await this.programs.findByWebsiteId(ctx.websiteId);
    if (!program || program.status !== 'ACTIVE') throw new NotFoundError('loyalty program', ctx.websiteId.toString());

    const tierRows = await this.tiers.listByProgramId(program.id);
    return {
      name: program.name,
      pointsPerCurrencyUnit: program.pointsPerCurrencyUnit,
      pointValue: program.pointValue,
      redeemMinPoints: program.redeemMinPoints,
      pointsExpiryMonths: program.pointsExpiryMonths,
      tiers: tierRows
        .map((t) => ({ name: t.name, thresholdPoints: t.thresholdPoints.toString(), earnMultiplier: t.earnMultiplier, sortOrder: t.sortOrder }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }
}
