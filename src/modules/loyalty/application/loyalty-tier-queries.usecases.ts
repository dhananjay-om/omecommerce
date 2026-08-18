import type { LoyaltyProgramRepository, LoyaltyTierRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { LoyaltyTierView, UpdateLoyaltyTierCommand } from './dto.js';

function toView(t: { id: bigint; name: string; thresholdPoints: bigint; earnMultiplier: string; sortOrder: number }): LoyaltyTierView {
  return { id: t.id.toString(), name: t.name, thresholdPoints: t.thresholdPoints.toString(), earnMultiplier: t.earnMultiplier, sortOrder: t.sortOrder };
}

export class ListLoyaltyTiers {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
  ) {}

  async execute(programPublicId: string): Promise<LoyaltyTierView[]> {
    const program = await this.programs.findByPublicId(programPublicId);
    if (!program) throw new NotFoundError('loyalty program', programPublicId);
    const rows = await this.tiers.listByProgramId(program.id);
    return rows.map(toView);
  }
}

/** `tierId` is the tier's raw bigint id as a string (LoyaltyTierView.id), not a uuidv7 publicId — LoyaltyTier has no publicId column. */
export class UpdateLoyaltyTier {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
  ) {}

  async execute(programPublicId: string, tierId: string, cmd: UpdateLoyaltyTierCommand): Promise<LoyaltyTierView> {
    const program = await this.programs.findByPublicId(programPublicId);
    if (!program) throw new NotFoundError('loyalty program', programPublicId);
    const tier = await this.tiers.findById(BigInt(tierId));
    if (!tier || tier.programId !== program.id) throw new NotFoundError('loyalty tier', tierId);
    if (cmd.thresholdPoints !== undefined && !/^\d+$/.test(cmd.thresholdPoints)) {
      throw new ValidationError('invalid thresholdPoints', [{ path: 'thresholdPoints', message: 'expected a non-negative integer' }]);
    }
    const updated = await this.tiers.update(tier.id, {
      name: cmd.name,
      thresholdPoints: cmd.thresholdPoints !== undefined ? BigInt(cmd.thresholdPoints) : undefined,
      earnMultiplier: cmd.earnMultiplier,
      sortOrder: cmd.sortOrder,
    });
    return toView(updated);
  }
}

export class DeleteLoyaltyTier {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
  ) {}

  async execute(programPublicId: string, tierId: string): Promise<void> {
    const program = await this.programs.findByPublicId(programPublicId);
    if (!program) throw new NotFoundError('loyalty program', programPublicId);
    const tier = await this.tiers.findById(BigInt(tierId));
    if (!tier || tier.programId !== program.id) throw new NotFoundError('loyalty tier', tierId);
    await this.tiers.delete(tier.id);
  }
}
