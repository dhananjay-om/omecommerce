import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWalletLedger } from '../wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaLoyaltyLedger } from './infrastructure/prisma-loyalty-ledger.js';
import { PrismaLoyaltyProgramRepository } from './infrastructure/prisma-loyalty-program.repository.js';
import { PrismaLoyaltyTierRepository } from './infrastructure/prisma-loyalty-tier.repository.js';
import { PrismaCustomerContextLookup, PrismaOrderLookup, PrismaWebsiteLookup, PrismaAdminUserLookup } from './infrastructure/lookups.js';
import { CreateLoyaltyProgram } from './application/create-loyalty-program.usecase.js';
import { CreateLoyaltyTier } from './application/create-loyalty-tier.usecase.js';
import { EarnLoyaltyPoints } from './application/earn-loyalty-points.usecase.js';
import { ReverseLoyaltyPoints } from './application/reverse-loyalty-points.usecase.js';
import { RedeemLoyaltyPoints } from './application/redeem-loyalty-points.usecase.js';
import { GetLoyaltyAccount, ListLoyaltyTransactions, AdjustLoyaltyAccount } from './application/loyalty-account-queries.usecases.js';
import { ListLoyaltyPrograms, GetLoyaltyProgram, UpdateLoyaltyProgram } from './application/loyalty-program-queries.usecases.js';
import { ListLoyaltyTiers, UpdateLoyaltyTier, DeleteLoyaltyTier } from './application/loyalty-tier-queries.usecases.js';
import {
  createLoyaltyProgramSchema,
  updateLoyaltyProgramSchema,
  createLoyaltyTierSchema,
  updateLoyaltyTierSchema,
  adjustLoyaltyAccountSchema,
  redeemLoyaltyPointsSchema,
} from './interface/http/schemas.js';

export interface LoyaltyRouters {
  admin: Router;
  store: Router;
}

/**
 * Composition root for the Loyalty module (plan/11 §2). Reuses Wallet's
 * WalletLedger directly (correctness-critical ledger logic, not duplicated)
 * for points-redeemed-as-store-credit — see RedeemLoyaltyPoints's header
 * comment. Also exports EarnLoyaltyPoints/ReverseLoyaltyPoints for
 * src/workers/loyalty-earn.worker.ts to call directly (not HTTP endpoints —
 * these are event-driven, triggered by the outbox relay).
 */
export function createLoyaltyModule(db: Db, authorize: (permission: string) => RequestHandler, requireCustomer: RequestHandler): LoyaltyRouters {
  const ledger = new PrismaLoyaltyLedger(db);
  const programs = new PrismaLoyaltyProgramRepository(db);
  const tiers = new PrismaLoyaltyTierRepository(db);
  const wallets = new PrismaWalletLedger(db);
  const customerContext = new PrismaCustomerContextLookup(db);
  const websites = new PrismaWebsiteLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);

  const createLoyaltyProgram = new CreateLoyaltyProgram(programs, websites);
  const listLoyaltyPrograms = new ListLoyaltyPrograms(programs);
  const getLoyaltyProgram = new GetLoyaltyProgram(programs);
  const updateLoyaltyProgram = new UpdateLoyaltyProgram(programs);
  const createLoyaltyTier = new CreateLoyaltyTier(programs, tiers);
  const listLoyaltyTiers = new ListLoyaltyTiers(programs, tiers);
  const updateLoyaltyTier = new UpdateLoyaltyTier(programs, tiers);
  const deleteLoyaltyTier = new DeleteLoyaltyTier(programs, tiers);
  const getLoyaltyAccount = new GetLoyaltyAccount(ledger, programs, tiers, customerContext);
  const listLoyaltyTransactions = new ListLoyaltyTransactions(ledger, programs, customerContext);
  const adjustLoyaltyAccount = new AdjustLoyaltyAccount(ledger, programs, customerContext);
  const redeemLoyaltyPoints = new RedeemLoyaltyPoints(ledger, programs, wallets, customerContext);

  async function resolveActorId(adminUserPublicId: string | undefined): Promise<bigint | undefined> {
    if (!adminUserPublicId) return undefined;
    return (await adminUsers.findIdByPublicId(adminUserPublicId)) ?? undefined;
  }

  const admin = Router();
  admin.get(
    '/loyalty/programs',
    authorize('loyalty:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listLoyaltyPrograms.execute() });
    }),
  );
  admin.post(
    '/loyalty/programs',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createLoyaltyProgramSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.status(201).json({ data: await createLoyaltyProgram.execute(body, actorId) });
    }),
  );
  admin.get(
    '/loyalty/programs/:id',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getLoyaltyProgram.execute(req.params.id!) });
    }),
  );
  admin.patch(
    '/loyalty/programs/:id',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateLoyaltyProgramSchema, req.body);
      res.json({ data: await updateLoyaltyProgram.execute(req.params.id!, body) });
    }),
  );
  admin.get(
    '/loyalty/programs/:id/tiers',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listLoyaltyTiers.execute(req.params.id!) });
    }),
  );
  admin.post(
    '/loyalty/programs/:id/tiers',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createLoyaltyTierSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.status(201).json({ data: await createLoyaltyTier.execute({ programPublicId: req.params.id!, ...body }, actorId) });
    }),
  );
  admin.patch(
    '/loyalty/programs/:id/tiers/:tierId',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateLoyaltyTierSchema, req.body);
      res.json({ data: await updateLoyaltyTier.execute(req.params.id!, req.params.tierId!, body) });
    }),
  );
  admin.delete(
    '/loyalty/programs/:id/tiers/:tierId',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      await deleteLoyaltyTier.execute(req.params.id!, req.params.tierId!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/customers/:id/loyalty',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getLoyaltyAccount.execute(req.params.id!) });
    }),
  );
  admin.get(
    '/customers/:id/loyalty/transactions',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listLoyaltyTransactions.execute(req.params.id!) });
    }),
  );
  admin.post(
    '/customers/:id/loyalty/actions/adjust',
    authorize('loyalty:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(adjustLoyaltyAccountSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await adjustLoyaltyAccount.execute({ customerPublicId: req.params.id!, ...body }, actorId) });
    }),
  );

  const store = Router();
  store.get(
    '/me/loyalty',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getLoyaltyAccount.execute(req.customer!.customerPublicId) });
    }),
  );
  store.get(
    '/me/loyalty/transactions',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await listLoyaltyTransactions.execute(req.customer!.customerPublicId) });
    }),
  );
  store.post(
    '/me/loyalty/actions/redeem',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(redeemLoyaltyPointsSchema, req.body);
      res.json({ data: await redeemLoyaltyPoints.execute(req.customer!.customerPublicId, body.points) });
    }),
  );

  return { admin, store };
}

/** Exposed for src/workers/loyalty-earn.worker.ts — event-driven, not HTTP-routed. */
export function createLoyaltyEarnDeps(db: Db): { earn: EarnLoyaltyPoints; reverse: ReverseLoyaltyPoints } {
  const ledger = new PrismaLoyaltyLedger(db);
  const programs = new PrismaLoyaltyProgramRepository(db);
  const tiers = new PrismaLoyaltyTierRepository(db);
  const orders = new PrismaOrderLookup(db);
  return {
    earn: new EarnLoyaltyPoints(orders, programs, tiers, ledger),
    reverse: new ReverseLoyaltyPoints(orders, programs, ledger),
  };
}
