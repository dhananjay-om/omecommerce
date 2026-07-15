import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWalletLedger } from '../wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaLoyaltyLedger } from '../loyalty/infrastructure/prisma-loyalty-ledger.js';
import { PrismaReferralProgramRepository } from './infrastructure/prisma-referral-program.repository.js';
import { PrismaReferralCodeRepository } from './infrastructure/prisma-referral-code.repository.js';
import { PrismaReferralRepository } from './infrastructure/prisma-referral.repository.js';
import { PrismaReferralRewardRepository } from './infrastructure/prisma-referral-reward.repository.js';
import { PrismaCustomerContextLookup, PrismaOrderLookup, PrismaWebsiteLookup, PrismaLoyaltyProgramLookup, PrismaAdminUserLookup } from './infrastructure/lookups.js';
import { CreateReferralProgram } from './application/create-referral-program.usecase.js';
import { AttachReferral } from './application/attach-referral.usecase.js';
import { GetMyReferrals } from './application/get-my-referrals.usecase.js';
import { QualifyReferral } from './application/qualify-referral.usecase.js';
import { ReverseReferralReward } from './application/reverse-referral-reward.usecase.js';
import { IssueReferralReward } from './application/issue-referral-reward.js';
import { createReferralProgramSchema, attachReferralSchema } from './interface/http/schemas.js';

export interface ReferralRouters {
  admin: Router;
  store: Router;
}

/**
 * Composition root for the Referral module (plan/11 §3). Reuses Wallet's
 * WalletLedger and Loyalty's LoyaltyLedger directly (correctness-critical
 * ledger logic, not duplicated) for reward issuance — see
 * issue-referral-reward.ts's header comment. Also exports
 * createReferralWorkerDeps for src/workers/referral-qualify.worker.ts to call
 * directly (not HTTP endpoints — these are event-driven, triggered by the
 * outbox relay), matching Loyalty's createLoyaltyEarnDeps.
 */
export function createReferralModule(db: Db, authorize: (permission: string) => RequestHandler, requireCustomer: RequestHandler): ReferralRouters {
  const programs = new PrismaReferralProgramRepository(db);
  const codes = new PrismaReferralCodeRepository(db);
  const referrals = new PrismaReferralRepository(db);
  const rewards = new PrismaReferralRewardRepository(db);
  const wallets = new PrismaWalletLedger(db);
  const loyaltyLedger = new PrismaLoyaltyLedger(db);
  const loyaltyPrograms = new PrismaLoyaltyProgramLookup(db);
  const customerContext = new PrismaCustomerContextLookup(db);
  const websites = new PrismaWebsiteLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);

  const issueReward = new IssueReferralReward(rewards, wallets, loyaltyLedger, loyaltyPrograms, customerContext);
  const createReferralProgram = new CreateReferralProgram(programs, websites, loyaltyPrograms);
  const attachReferral = new AttachReferral(customerContext, codes, programs, referrals, issueReward);
  const getMyReferrals = new GetMyReferrals(customerContext, programs, codes, referrals, rewards);

  async function resolveActorId(adminUserPublicId: string | undefined): Promise<bigint | undefined> {
    if (!adminUserPublicId) return undefined;
    return (await adminUsers.findIdByPublicId(adminUserPublicId)) ?? undefined;
  }

  const admin = Router();
  admin.post(
    '/referral/programs',
    authorize('referral:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createReferralProgramSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.status(201).json({ data: await createReferralProgram.execute(body, actorId) });
    }),
  );

  const store = Router();
  store.get(
    '/me/referrals',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getMyReferrals.execute(req.customer!.customerPublicId) });
    }),
  );
  store.post(
    '/me/referrals/actions/attach',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(attachReferralSchema, req.body);
      res.json({ data: await attachReferral.execute(req.customer!.customerPublicId, body.code) });
    }),
  );

  return { admin, store };
}

/** Exposed for src/workers/referral-qualify.worker.ts — event-driven, not HTTP-routed. */
export function createReferralWorkerDeps(db: Db): { qualify: QualifyReferral; reverse: ReverseReferralReward } {
  const programs = new PrismaReferralProgramRepository(db);
  const referrals = new PrismaReferralRepository(db);
  const rewards = new PrismaReferralRewardRepository(db);
  const wallets = new PrismaWalletLedger(db);
  const loyaltyLedger = new PrismaLoyaltyLedger(db);
  const loyaltyPrograms = new PrismaLoyaltyProgramLookup(db);
  const customerContext = new PrismaCustomerContextLookup(db);
  const orders = new PrismaOrderLookup(db);
  const issueReward = new IssueReferralReward(rewards, wallets, loyaltyLedger, loyaltyPrograms, customerContext);

  return {
    qualify: new QualifyReferral(orders, programs, referrals, issueReward),
    reverse: new ReverseReferralReward(orders, referrals, rewards, wallets, loyaltyLedger, loyaltyPrograms, customerContext),
  };
}
