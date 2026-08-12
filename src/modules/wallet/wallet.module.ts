import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWalletLedger } from './infrastructure/prisma-wallet-ledger.js';
import { PrismaCustomerContextLookup } from './infrastructure/prisma-customer-context-lookup.js';
import { PrismaAdminUserLookup } from './infrastructure/prisma-admin-user-lookup.js';
import { CreditWallet } from './application/credit-wallet.usecase.js';
import { AdjustWallet } from './application/adjust-wallet.usecase.js';
import { FreezeWallet, UnfreezeWallet } from './application/manage-wallet-status.usecases.js';
import { GetWalletBalance, ListWalletTransactions } from './application/get-wallet.usecases.js';
import { creditWalletSchema, adjustWalletSchema } from './interface/http/schemas.js';

export interface WalletRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Wallet/Store Credit module (plan/10 §4). */
export function createWalletModule(db: Db, authorize: (permission: string) => RequestHandler, requireCustomer: RequestHandler): WalletRouters {
  const wallets = new PrismaWalletLedger(db);
  const customerContext = new PrismaCustomerContextLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);

  const creditWallet = new CreditWallet(wallets, customerContext);
  const adjustWallet = new AdjustWallet(wallets, customerContext);
  const freezeWallet = new FreezeWallet(wallets, customerContext);
  const unfreezeWallet = new UnfreezeWallet(wallets, customerContext);
  const getWalletBalance = new GetWalletBalance(wallets, customerContext);
  const listWalletTransactions = new ListWalletTransactions(wallets, customerContext);

  async function resolveActorId(adminUserPublicId: string | undefined): Promise<bigint | undefined> {
    if (!adminUserPublicId) return undefined;
    return (await adminUsers.findIdByPublicId(adminUserPublicId)) ?? undefined;
  }

  const admin = Router();
  admin.get(
    '/customers/:id/wallet',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getWalletBalance.execute(req.params.id!) });
    }),
  );
  admin.get(
    '/customers/:id/wallet/transactions',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listWalletTransactions.execute(req.params.id!) });
    }),
  );
  admin.post(
    '/customers/:id/wallet/actions/credit',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(creditWalletSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await creditWallet.execute({ customerPublicId: req.params.id!, ...body }, actorId) });
    }),
  );
  admin.post(
    '/customers/:id/wallet/actions/adjust',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(adjustWalletSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await adjustWallet.execute({ customerPublicId: req.params.id!, ...body }, actorId) });
    }),
  );
  admin.post(
    '/customers/:id/wallet/actions/freeze',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      await freezeWallet.execute(req.params.id!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/customers/:id/wallet/actions/unfreeze',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      await unfreezeWallet.execute(req.params.id!);
      res.status(204).send();
    }),
  );

  const store = Router();
  store.get(
    '/me/wallet',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getWalletBalance.execute(req.customer!.customerPublicId) });
    }),
  );
  store.get(
    '/me/wallet/transactions',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await listWalletTransactions.execute(req.customer!.customerPublicId) });
    }),
  );

  return { admin, store };
}
