import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWalletLedger } from '../wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaGiftCardLedger } from './infrastructure/prisma-giftcard-ledger.js';
import { PrismaWebsiteLookup, PrismaCustomerLookup } from './infrastructure/lookups.js';
import { PrismaAdminUserLookup } from './infrastructure/prisma-admin-user-lookup.js';
import { IssueGiftCard } from './application/issue-gift-card.usecase.js';
import { GetGiftCard, GetGiftCardByCode, ListGiftCardTransactions, DisableGiftCard, AdjustGiftCard } from './application/gift-card-queries.usecases.js';
import { RedeemGiftCardIntoWallet } from './application/redeem-gift-card-into-wallet.usecase.js';
import { issueGiftCardSchema, adjustGiftCardSchema, redeemGiftCardSchema } from './interface/http/schemas.js';

export interface GiftCardRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Gift Card module (plan/10 §3). */
export function createGiftCardModule(
  db: Db,
  hmacSecret: string,
  authorize: (permission: string) => RequestHandler,
  requireCustomer: RequestHandler,
): GiftCardRouters {
  const giftCards = new PrismaGiftCardLedger(db);
  const wallets = new PrismaWalletLedger(db);
  const websites = new PrismaWebsiteLookup(db);
  const customers = new PrismaCustomerLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);

  const issueGiftCard = new IssueGiftCard(giftCards, websites, hmacSecret);
  const getGiftCard = new GetGiftCard(giftCards);
  const getGiftCardByCode = new GetGiftCardByCode(giftCards, hmacSecret);
  const listGiftCardTransactions = new ListGiftCardTransactions(giftCards);
  const disableGiftCard = new DisableGiftCard(giftCards);
  const adjustGiftCard = new AdjustGiftCard(giftCards);
  const redeemGiftCardIntoWallet = new RedeemGiftCardIntoWallet(giftCards, wallets, customers, hmacSecret);

  async function resolveActorId(adminUserPublicId: string | undefined): Promise<bigint | undefined> {
    if (!adminUserPublicId) return undefined;
    return (await adminUsers.findIdByPublicId(adminUserPublicId)) ?? undefined;
  }

  const admin = Router();
  admin.post(
    '/gift-cards',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(issueGiftCardSchema, req.body);
      const createdBy = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.status(201).json({ data: await issueGiftCard.execute(body, createdBy) });
    }),
  );
  admin.get(
    '/gift-cards/:id',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getGiftCard.execute(req.params.id!) });
    }),
  );
  admin.get(
    '/gift-cards/:id/transactions',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listGiftCardTransactions.execute(req.params.id!) });
    }),
  );
  admin.post(
    '/gift-cards/:id/actions/disable',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      await disableGiftCard.execute(req.params.id!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/gift-cards/:id/actions/adjust',
    authorize('wallet:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(adjustGiftCardSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await adjustGiftCard.execute(req.params.id!, body.amount, body.reason, actorId) });
    }),
  );

  const store = Router();
  store.get(
    '/gift-cards/:code/balance',
    asyncHandler(async (req, res) => {
      res.json({ data: await getGiftCardByCode.execute(req.params.code!) });
    }),
  );
  store.post(
    '/me/wallet/actions/redeem-gift-card',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(redeemGiftCardSchema, req.body);
      res.json({ data: await redeemGiftCardIntoWallet.execute(req.customer!.customerPublicId, body.code) });
    }),
  );

  return { admin, store };
}
