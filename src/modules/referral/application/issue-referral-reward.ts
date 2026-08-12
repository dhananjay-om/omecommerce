import type { ReferralBeneficiary } from '@prisma/client';
import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { LoyaltyLedger } from '../../loyalty/domain/repositories.js';
import type {
  ReferralRewardRepository,
  ReferralRewardInfo,
  ReferralInfo,
  ReferralProgramInfo,
  CustomerContextLookup,
  LoyaltyProgramLookup,
} from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

/**
 * Issues one side's reward for a referral — reused by AttachReferral (the
 * referee's reward, always issued at attach time; the referrer's too, for a
 * SIGNUP-qualifying program) and QualifyReferral (the referrer's reward, for
 * a FIRST_ORDER-qualifying program). Reuses WalletLedger.credit and
 * LoyaltyLedger.earn directly — correctness-critical ledger reuse, the same
 * established pattern as RedeemLoyaltyPoints reusing WalletLedger, rather
 * than a new cross-module RewardIssuer abstraction for what's still one
 * caller's two reward paths.
 *
 * Idempotent: checked first against `@@unique([referralId, beneficiary])`
 * (a re-delivered worker job or a retried attach is a no-op, returning the
 * existing reward), and the underlying ledger call itself also carries a
 * stable `idempotencyKey` as a second backstop.
 */
export class IssueReferralReward {
  constructor(
    private readonly rewards: ReferralRewardRepository,
    private readonly wallets: WalletLedger,
    private readonly loyaltyLedger: LoyaltyLedger,
    private readonly loyaltyPrograms: LoyaltyProgramLookup,
    private readonly customerContext: CustomerContextLookup,
  ) {}

  async execute(referral: ReferralInfo, beneficiary: ReferralBeneficiary, program: ReferralProgramInfo): Promise<ReferralRewardInfo> {
    const existing = await this.rewards.findByReferralAndBeneficiary(referral.id, beneficiary);
    if (existing) return existing;

    const customerId = beneficiary === 'REFERRER' ? referral.referrerCustomerId : referral.refereeCustomerId;
    const rewardType = beneficiary === 'REFERRER' ? program.referrerRewardType : program.refereeRewardType;
    const amount = beneficiary === 'REFERRER' ? program.referrerRewardAmount : program.refereeRewardAmount;
    const points = beneficiary === 'REFERRER' ? program.referrerRewardPoints : program.refereeRewardPoints;
    const idempotencyKey = `referral-reward-${referral.id}-${beneficiary}`;
    const reason = `Referral reward (${beneficiary.toLowerCase()})`;

    // Customer FKs on Referral are RESTRICT, so the referrer/referee can
    // never be deleted out from under an existing Referral row — this
    // should always resolve.
    const ctx = await this.customerContext.resolveByCustomerId(customerId);
    if (!ctx) {
      throw new NotFoundError('customer', customerId.toString());
    }

    if (rewardType === 'STORE_CREDIT') {
      const wallet = await this.wallets.getOrCreateWallet(customerId, ctx.websiteId, ctx.currency);
      await this.wallets.credit(wallet.id, amount!, 'STORE_CREDIT', 'REFERRAL', {
        refType: 'Referral',
        refId: referral.id,
        idempotencyKey,
        reason,
      });
    } else {
      const loyaltyProgram = await this.loyaltyPrograms.findByWebsiteId(ctx.websiteId);
      // A referral program can only be configured with a POINTS reward type
      // if a Loyalty program already exists for the same website —
      // validated at CreateReferralProgram time — so this is always found.
      if (loyaltyProgram) {
        const account = await this.loyaltyLedger.getOrCreateAccount(customerId, loyaltyProgram.id);
        await this.loyaltyLedger.earn(account.id, points!, 'REFERRAL', {
          refType: 'Referral',
          refId: referral.id,
          idempotencyKey,
          reason,
        });
      }
    }

    return this.rewards.create({ referralId: referral.id, beneficiary, rewardType, amount, points });
  }
}
