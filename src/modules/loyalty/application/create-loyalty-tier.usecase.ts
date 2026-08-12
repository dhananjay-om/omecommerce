import type { LoyaltyProgramRepository, LoyaltyTierRepository } from '../domain/repositories.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { CreateLoyaltyTierCommand, LoyaltyTierView } from './dto.js';

export class CreateLoyaltyTier {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly tiers: LoyaltyTierRepository,
  ) {}

  async execute(cmd: CreateLoyaltyTierCommand, actorId?: bigint): Promise<LoyaltyTierView> {
    const program = await this.programs.findByPublicId(cmd.programPublicId);
    if (!program) {
      throw new NotFoundError('loyalty program', cmd.programPublicId);
    }
    if (!/^\d+$/.test(cmd.thresholdPoints)) {
      throw new ValidationError('invalid thresholdPoints', [{ path: 'thresholdPoints', message: 'expected a non-negative integer' }]);
    }
    const tier = await this.tiers.create({
      programId: program.id,
      name: cmd.name,
      thresholdPoints: BigInt(cmd.thresholdPoints),
      earnMultiplier: cmd.earnMultiplier,
      sortOrder: cmd.sortOrder,
      createdBy: actorId,
    });
    return { id: tier.id.toString(), name: tier.name, thresholdPoints: tier.thresholdPoints.toString(), earnMultiplier: tier.earnMultiplier };
  }
}
