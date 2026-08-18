import type { ReferralRewardType } from '@prisma/client';
import type { LoyaltyProgramLookup } from '../domain/repositories.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';

/**
 * Exactly one of amount/points must be given, matching the declared reward
 * type, and it must be strictly positive — a configured reward of zero would
 * pass a looser check but then fail the DB's own `referral_reward_shape`
 * CHECK at the first actual issuance, so it's rejected here instead. A
 * POINTS type additionally requires a Loyalty program to already exist for
 * the website. Shared by CreateReferralProgram and UpdateReferralProgram —
 * an update touching any reward field must satisfy this exactly as strictly
 * as creation does.
 */
export async function validateRewardShape(
  loyaltyPrograms: LoyaltyProgramLookup,
  side: 'referrer' | 'referee',
  type: ReferralRewardType,
  amount: string | null | undefined,
  points: string | null | undefined,
  websiteId: bigint,
): Promise<void> {
  if (type === 'STORE_CREDIT') {
    if (!amount || toMinorUnits(amount) <= 0n) {
      throw new ValidationError(`${side}RewardAmount must be a positive amount when ${side}RewardType is STORE_CREDIT`, [
        { path: `${side}RewardAmount`, message: 'required, positive' },
      ]);
    }
  } else {
    if (!points || BigInt(points) <= 0n) {
      throw new ValidationError(`${side}RewardPoints must be a positive integer when ${side}RewardType is POINTS`, [
        { path: `${side}RewardPoints`, message: 'required, positive' },
      ]);
    }
    if (!(await loyaltyPrograms.findByWebsiteId(websiteId))) {
      throw new ValidationError(`a Loyalty program must exist for this website before configuring a POINTS referral reward`, [
        { path: `${side}RewardType`, message: 'no Loyalty program configured for this website' },
      ]);
    }
  }
}
