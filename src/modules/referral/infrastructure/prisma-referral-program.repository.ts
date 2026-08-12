import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { ReferralProgramRepository, ReferralProgramInfo, CreateReferralProgramInput } from '../domain/repositories.js';

function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

const PROGRAM_SELECT = {
  id: true,
  publicId: true,
  websiteId: true,
  name: true,
  status: true,
  qualifyingEvent: true,
  minOrderAmount: true,
  referrerRewardType: true,
  referrerRewardAmount: true,
  referrerRewardPoints: true,
  refereeRewardType: true,
  refereeRewardAmount: true,
  refereeRewardPoints: true,
  maxReferralsPerCustomer: true,
  attributionWindowDays: true,
} as const;

type ProgramRow = {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  name: string;
  status: ReferralProgramInfo['status'];
  qualifyingEvent: ReferralProgramInfo['qualifyingEvent'];
  minOrderAmount: { toString(): string } | null;
  referrerRewardType: ReferralProgramInfo['referrerRewardType'];
  referrerRewardAmount: { toString(): string } | null;
  referrerRewardPoints: bigint | null;
  refereeRewardType: ReferralProgramInfo['refereeRewardType'];
  refereeRewardAmount: { toString(): string } | null;
  refereeRewardPoints: bigint | null;
  maxReferralsPerCustomer: number | null;
  attributionWindowDays: number | null;
};

function toInfo(row: ProgramRow): ReferralProgramInfo {
  return {
    id: row.id,
    publicId: row.publicId,
    websiteId: row.websiteId,
    name: row.name,
    status: row.status,
    qualifyingEvent: row.qualifyingEvent,
    minOrderAmount: row.minOrderAmount ? formatDecimal(row.minOrderAmount) : null,
    referrerRewardType: row.referrerRewardType,
    referrerRewardAmount: row.referrerRewardAmount ? formatDecimal(row.referrerRewardAmount) : null,
    referrerRewardPoints: row.referrerRewardPoints,
    refereeRewardType: row.refereeRewardType,
    refereeRewardAmount: row.refereeRewardAmount ? formatDecimal(row.refereeRewardAmount) : null,
    refereeRewardPoints: row.refereeRewardPoints,
    maxReferralsPerCustomer: row.maxReferralsPerCustomer,
    attributionWindowDays: row.attributionWindowDays,
  };
}

export class PrismaReferralProgramRepository implements ReferralProgramRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateReferralProgramInput): Promise<ReferralProgramInfo> {
    const row = await this.db.referralProgram.create({
      data: {
        websiteId: input.websiteId,
        name: input.name,
        qualifyingEvent: input.qualifyingEvent,
        minOrderAmount: input.minOrderAmount,
        referrerRewardType: input.referrerRewardType,
        referrerRewardAmount: input.referrerRewardAmount,
        referrerRewardPoints: input.referrerRewardPoints,
        refereeRewardType: input.refereeRewardType,
        refereeRewardAmount: input.refereeRewardAmount,
        refereeRewardPoints: input.refereeRewardPoints,
        maxReferralsPerCustomer: input.maxReferralsPerCustomer,
        attributionWindowDays: input.attributionWindowDays,
        createdBy: input.createdBy,
      },
      select: PROGRAM_SELECT,
    });
    return toInfo(row);
  }

  async findById(id: bigint): Promise<ReferralProgramInfo | null> {
    const row = await this.db.referralProgram.findFirst({ where: { id }, select: PROGRAM_SELECT });
    return row ? toInfo(row) : null;
  }

  async findByWebsiteId(websiteId: bigint): Promise<ReferralProgramInfo | null> {
    const row = await this.db.referralProgram.findFirst({ where: { websiteId }, select: PROGRAM_SELECT });
    return row ? toInfo(row) : null;
  }
}
