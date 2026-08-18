import type { LoyaltyProgramRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import type { CreateLoyaltyProgramCommand, LoyaltyProgramView } from './dto.js';

export interface WebsiteLookup {
  byCode(code: string): Promise<{ id: bigint } | null>;
}

export class CreateLoyaltyProgram {
  constructor(
    private readonly programs: LoyaltyProgramRepository,
    private readonly websites: WebsiteLookup,
  ) {}

  async execute(cmd: CreateLoyaltyProgramCommand, actorId?: bigint): Promise<LoyaltyProgramView> {
    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) {
      throw new NotFoundError('website', cmd.websiteCode);
    }
    if (await this.programs.findByWebsiteId(website.id)) {
      throw new ConflictError(`a loyalty program already exists for this website: ${cmd.websiteCode}`);
    }
    const program = await this.programs.create({
      websiteId: website.id,
      name: cmd.name,
      pointsPerCurrencyUnit: cmd.pointsPerCurrencyUnit,
      pointValue: cmd.pointValue,
      redeemMinPoints: cmd.redeemMinPoints,
      pointsExpiryMonths: cmd.pointsExpiryMonths,
      createdBy: actorId,
    });
    return {
      publicId: program.publicId,
      name: program.name,
      status: program.status,
      pointsPerCurrencyUnit: program.pointsPerCurrencyUnit,
      pointValue: program.pointValue,
      redeemMinPoints: program.redeemMinPoints,
      pointsExpiryMonths: program.pointsExpiryMonths,
    };
  }
}
