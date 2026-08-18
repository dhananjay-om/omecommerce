import type { ReferralRepository } from '../domain/repositories.js';
import type { ListReferralsQuery, AdminReferralListView, AdminReferralListItemView, ReferralRewardView } from './dto.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function findReward(rewards: Array<{ beneficiary: 'REFERRER' | 'REFEREE'; rewardType: string; amount: string | null; points: bigint | null }>, beneficiary: 'REFERRER' | 'REFEREE'): ReferralRewardView | null {
  const r = rewards.find((x) => x.beneficiary === beneficiary);
  if (!r) return null;
  return { beneficiary, rewardType: r.rewardType as ReferralRewardView['rewardType'], amount: r.amount, points: r.points?.toString() ?? null };
}

/** Admin browse (Content > Referrals) — every referral across all customers. */
export class ListReferralsForAdmin {
  constructor(private readonly referrals: ReferralRepository) {}

  async execute(query: ListReferralsQuery): Promise<AdminReferralListView> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const result = await this.referrals.listForAdmin({ status: query.status, page, pageSize });
    const referralViews: AdminReferralListItemView[] = result.referrals.map((r) => ({
      publicId: r.publicId,
      referrerEmail: r.referrerEmail,
      refereeEmail: r.refereeEmail,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      qualifiedAt: r.qualifiedAt?.toISOString() ?? null,
      rewardedAt: r.rewardedAt?.toISOString() ?? null,
      referrerReward: findReward(r.rewards, 'REFERRER'),
      refereeReward: findReward(r.rewards, 'REFEREE'),
    }));
    return { total: result.total, page, pageSize, referrals: referralViews };
  }
}
