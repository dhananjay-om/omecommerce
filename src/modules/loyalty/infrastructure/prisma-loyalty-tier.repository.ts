import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { LoyaltyTierRepository, LoyaltyTierInfo, CreateLoyaltyTierInput } from '../domain/repositories.js';

function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

const TIER_SELECT = { id: true, programId: true, name: true, thresholdPoints: true, earnMultiplier: true, sortOrder: true } as const;

function toInfo(row: {
  id: bigint;
  programId: bigint;
  name: string;
  thresholdPoints: bigint;
  earnMultiplier: { toString(): string };
  sortOrder: number;
}): LoyaltyTierInfo {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    thresholdPoints: row.thresholdPoints,
    earnMultiplier: formatDecimal(row.earnMultiplier),
    sortOrder: row.sortOrder,
  };
}

export class PrismaLoyaltyTierRepository implements LoyaltyTierRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateLoyaltyTierInput): Promise<LoyaltyTierInfo> {
    const row = await this.db.loyaltyTier.create({
      data: {
        programId: input.programId,
        name: input.name,
        thresholdPoints: input.thresholdPoints,
        earnMultiplier: input.earnMultiplier,
        sortOrder: input.sortOrder,
        createdBy: input.createdBy,
      },
      select: TIER_SELECT,
    });
    return toInfo(row);
  }

  async listByProgramId(programId: bigint): Promise<LoyaltyTierInfo[]> {
    const rows = await this.db.loyaltyTier.findMany({ where: { programId }, select: TIER_SELECT, orderBy: { sortOrder: 'asc' } });
    return rows.map(toInfo);
  }
}
