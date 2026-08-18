import type { LoyaltyProgramRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { LoyaltyProgramView, UpdateLoyaltyProgramCommand } from './dto.js';

function toView(p: { publicId: string; name: string; status: LoyaltyProgramView['status']; pointsPerCurrencyUnit: string; pointValue: string; redeemMinPoints: number; pointsExpiryMonths: number | null }): LoyaltyProgramView {
  return {
    publicId: p.publicId,
    name: p.name,
    status: p.status,
    pointsPerCurrencyUnit: p.pointsPerCurrencyUnit,
    pointValue: p.pointValue,
    redeemMinPoints: p.redeemMinPoints,
    pointsExpiryMonths: p.pointsExpiryMonths,
  };
}

/** Admin browse (Content > Loyalty) — one card per website's program, since LoyaltyProgram is @@unique([websiteId]). */
export class ListLoyaltyPrograms {
  constructor(private readonly programs: LoyaltyProgramRepository) {}

  async execute(): Promise<LoyaltyProgramView[]> {
    const rows = await this.programs.list();
    return rows.map(toView);
  }
}

export class GetLoyaltyProgram {
  constructor(private readonly programs: LoyaltyProgramRepository) {}

  async execute(publicId: string): Promise<LoyaltyProgramView> {
    const program = await this.programs.findByPublicId(publicId);
    if (!program) throw new NotFoundError('loyalty program', publicId);
    return toView(program);
  }
}

export class UpdateLoyaltyProgram {
  constructor(private readonly programs: LoyaltyProgramRepository) {}

  async execute(publicId: string, cmd: UpdateLoyaltyProgramCommand): Promise<LoyaltyProgramView> {
    const program = await this.programs.findByPublicId(publicId);
    if (!program) throw new NotFoundError('loyalty program', publicId);
    const updated = await this.programs.update(program.id, cmd);
    return toView(updated);
  }
}
