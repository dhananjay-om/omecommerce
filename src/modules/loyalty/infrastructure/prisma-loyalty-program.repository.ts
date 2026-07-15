import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { LoyaltyProgramRepository, LoyaltyProgramInfo, CreateLoyaltyProgramInput } from '../domain/repositories.js';

// Prisma's Decimal.toString() strips trailing zeros ("1.0000" -> "1"); this
// round-trip through the fixed-point minor-units helpers restores the scale-4
// string, same fix used by every other money-adjacent ledger in this codebase.
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

const PROGRAM_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  name: true,
  status: true,
  pointsPerCurrencyUnit: true,
  pointValue: true,
  redeemMinPoints: true,
  pointsExpiryMonths: true,
} as const;

function toInfo(row: {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  name: string;
  status: LoyaltyProgramInfo['status'];
  pointsPerCurrencyUnit: { toString(): string };
  pointValue: { toString(): string };
  redeemMinPoints: number;
  pointsExpiryMonths: number | null;
}): LoyaltyProgramInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    websiteId: row.websiteId,
    name: row.name,
    status: row.status,
    pointsPerCurrencyUnit: formatDecimal(row.pointsPerCurrencyUnit),
    pointValue: formatDecimal(row.pointValue),
    redeemMinPoints: row.redeemMinPoints,
    pointsExpiryMonths: row.pointsExpiryMonths,
  };
}

export class PrismaLoyaltyProgramRepository implements LoyaltyProgramRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateLoyaltyProgramInput): Promise<LoyaltyProgramInfo> {
    const row = await this.db.loyaltyProgram.create({
      data: {
        websiteId: input.websiteId,
        name: input.name,
        pointsPerCurrencyUnit: input.pointsPerCurrencyUnit,
        pointValue: input.pointValue,
        redeemMinPoints: input.redeemMinPoints,
        pointsExpiryMonths: input.pointsExpiryMonths,
        createdBy: input.createdBy,
      },
      select: PROGRAM_SELECT,
    });
    return toInfo(row);
  }

  async findByWebsiteId(websiteId: bigint): Promise<LoyaltyProgramInfo | null> {
    const row = await this.db.loyaltyProgram.findFirst({ where: { websiteId }, select: PROGRAM_SELECT });
    return row ? toInfo(row) : null;
  }

  async findByPublicId(publicId: string): Promise<LoyaltyProgramInfo | null> {
    const row = await this.db.loyaltyProgram.findFirst({ where: { publicId }, select: PROGRAM_SELECT });
    return row ? toInfo(row) : null;
  }
}
