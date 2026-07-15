import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ReferralRepository, ReferralInfo, CreateReferralInput } from '../domain/repositories.js';

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
}
