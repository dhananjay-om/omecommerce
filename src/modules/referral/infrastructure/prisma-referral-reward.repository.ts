import type { ReferralBeneficiary } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { ReferralRewardRepository, ReferralRewardInfo, IssueReferralRewardInput } from '../domain/repositories.js';

function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

const REWARD_SELECT = {
  id: true,
  referralId: true,
  beneficiary: true,
  rewardType: true,
  amount: true,
  points: true,
  createdAt: true,
} as const;

type RewardRow = {
  id: bigint;
  referralId: bigint;
  beneficiary: ReferralBeneficiary;
  rewardType: ReferralRewardInfo['rewardType'];
  amount: { toString(): string } | null;
  points: bigint | null;
  createdAt: Date;
};

function toInfo(row: RewardRow): ReferralRewardInfo {
  return {
    id: row.id,
    referralId: row.referralId,
    beneficiary: row.beneficiary,
    rewardType: row.rewardType,
    amount: row.amount ? formatDecimal(row.amount) : null,
    points: row.points,
    createdAt: row.createdAt,
  };
}

export class PrismaReferralRewardRepository implements ReferralRewardRepository {
  constructor(private readonly db: Db) {}

  async findByReferralAndBeneficiary(referralId: bigint, beneficiary: ReferralBeneficiary): Promise<ReferralRewardInfo | null> {
    const row = await this.db.referralReward.findFirst({ where: { referralId, beneficiary }, select: REWARD_SELECT });
    return row ? toInfo(row) : null;
  }

  async create(input: IssueReferralRewardInput): Promise<ReferralRewardInfo> {
    const row = await this.db.referralReward.create({
      data: {
        referralId: input.referralId,
        beneficiary: input.beneficiary,
        rewardType: input.rewardType,
        amount: input.amount,
        points: input.points,
      },
      select: REWARD_SELECT,
    });
    return toInfo(row);
  }
}
