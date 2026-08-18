import type { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import type { ReferralRepository, ReferralInfo, CreateReferralInput, AdminReferralFilter, AdminReferralListResult } from '../domain/repositories.js';

function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

const REFERRAL_SELECT = {
  id: true,
  publicId: true,
  programId: true,
  referralCodeId: true,
  referrerCustomerId: true,
  refereeCustomerId: true,
  status: true,
  qualifyingOrderId: true,
  createdAt: true,
  qualifiedAt: true,
  rewardedAt: true,
} as const;

export class PrismaReferralRepository implements ReferralRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateReferralInput): Promise<ReferralInfo> {
    return this.db.referral.create({
      data: {
        programId: input.programId,
        referralCodeId: input.referralCodeId,
        referrerCustomerId: input.referrerCustomerId,
        refereeCustomerId: input.refereeCustomerId,
      },
      select: REFERRAL_SELECT,
    });
  }

  async findByProgramAndReferee(programId: bigint, refereeCustomerId: bigint): Promise<ReferralInfo | null> {
    return this.db.referral.findFirst({ where: { programId, refereeCustomerId }, select: REFERRAL_SELECT });
  }

  async findByQualifyingOrderId(qualifyingOrderId: bigint): Promise<ReferralInfo | null> {
    return this.db.referral.findFirst({ where: { qualifyingOrderId }, select: REFERRAL_SELECT });
  }

  async countByReferrer(programId: bigint, referrerCustomerId: bigint): Promise<number> {
    return this.db.referral.count({ where: { programId, referrerCustomerId } });
  }

  async listByReferrer(programId: bigint, referrerCustomerId: bigint): Promise<ReferralInfo[]> {
    return this.db.referral.findMany({ where: { programId, referrerCustomerId }, select: REFERRAL_SELECT, orderBy: { createdAt: 'desc' } });
  }

  async markQualified(id: bigint, qualifyingOrderId: bigint | null): Promise<ReferralInfo> {
    return this.db.referral.update({
      where: { id },
      data: { status: 'QUALIFIED', qualifyingOrderId, qualifiedAt: new Date() },
      select: REFERRAL_SELECT,
    });
  }

  async markRewarded(id: bigint): Promise<ReferralInfo> {
    return this.db.referral.update({ where: { id }, data: { status: 'REWARDED', rewardedAt: new Date() }, select: REFERRAL_SELECT });
  }

  async markExpired(id: bigint): Promise<ReferralInfo> {
    return this.db.referral.update({ where: { id }, data: { status: 'EXPIRED' }, select: REFERRAL_SELECT });
  }

  async markReversed(id: bigint): Promise<ReferralInfo> {
    return this.db.referral.update({ where: { id }, data: { status: 'REVERSED' }, select: REFERRAL_SELECT });
  }

  async listForAdmin(filter: AdminReferralFilter): Promise<AdminReferralListResult> {
    const where: Prisma.ReferralWhereInput = { ...(filter.status ? { status: filter.status } : {}) };
    const [total, rows] = await this.db.$transaction([
      this.db.referral.count({ where }),
      this.db.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
        select: {
          publicId: true,
          status: true,
          createdAt: true,
          qualifiedAt: true,
          rewardedAt: true,
          referrer: { select: { email: true } },
          referee: { select: { email: true } },
          rewards: { select: { beneficiary: true, rewardType: true, amount: true, points: true } },
        },
      }),
    ]);
    return {
      total,
      referrals: rows.map((r) => ({
        publicId: r.publicId,
        referrerEmail: r.referrer.email,
        refereeEmail: r.referee.email,
        status: r.status,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        rewardedAt: r.rewardedAt,
        rewards: r.rewards.map((rw) => ({
          beneficiary: rw.beneficiary,
          rewardType: rw.rewardType,
          amount: rw.amount ? formatDecimal(rw.amount) : null,
          points: rw.points,
        })),
      })),
    };
  }
}
