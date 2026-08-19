import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCompanyRepository } from './infrastructure/prisma-company.repository.js';
import { PrismaWebsiteLookup, PrismaCustomerLookup, PrismaCustomerGroupLookup } from './infrastructure/lookups.js';
import { PrismaAdminUserLookup } from './infrastructure/prisma-admin-user-lookup.js';
import { PrismaCompanyCreditLedger } from './infrastructure/prisma-company-credit-ledger.js';
import { PrismaCompanyOrderSettlement } from './infrastructure/prisma-company-order-settlement.js';
import { CreateCompany } from './application/create-company.usecase.js';
import { GetCompany, ListCompanies, UpdateCompany, SetCompanyStatus } from './application/company-queries.usecases.js';
import { ListCompanyMembers, AddCompanyMember, RemoveCompanyMember, UpdateCompanyMemberRole } from './application/company-member.usecases.js';
import { GetMyCompany, ListMyCompanyMembers, AddMyCompanyMember, RemoveMyCompanyMember, UpdateMyCompanyMemberRole } from './application/my-company.usecases.js';
import {
  SetCompanyCreditTerms,
  GetCompanyCreditAccount,
  ListCompanyCreditTransactions,
  GetCompanyAgingReport,
  RecordCompanyCreditPayment,
  AdjustCompanyCredit,
  SetCompanyCreditAccountStatus,
  GetMyCompanyCredit,
} from './application/company-credit.usecases.js';
import {
  createCompanySchema,
  updateCompanySchema,
  setCompanyStatusSchema,
  listCompaniesQuerySchema,
  addCompanyMemberSchema,
  updateCompanyMemberRoleSchema,
  setCompanyCreditTermsSchema,
  recordCompanyCreditPaymentSchema,
  adjustCompanyCreditSchema,
  setCompanyCreditAccountStatusSchema,
} from './interface/http/schemas.js';

export interface CompanyRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the B2B Company module (plan/15 Phase 6). */
export function createCompanyModule(db: Db, authorize: (permission: string) => RequestHandler, requireCustomer: RequestHandler): CompanyRouters {
  const companies = new PrismaCompanyRepository(db);
  const websites = new PrismaWebsiteLookup(db);
  const customers = new PrismaCustomerLookup(db);
  const customerGroups = new PrismaCustomerGroupLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);
  const creditLedger = new PrismaCompanyCreditLedger(db);
  const orderSettlement = new PrismaCompanyOrderSettlement(db);

  const createCompany = new CreateCompany(companies, websites, customerGroups);
  const getCompany = new GetCompany(companies, websites, customerGroups);
  const listCompanies = new ListCompanies(companies, websites);
  const updateCompany = new UpdateCompany(companies, websites, customerGroups);
  const setCompanyStatus = new SetCompanyStatus(companies, websites, customerGroups);
  const listCompanyMembers = new ListCompanyMembers(companies);
  const addCompanyMember = new AddCompanyMember(companies, customers);
  const removeCompanyMember = new RemoveCompanyMember(companies, customers);
  const updateCompanyMemberRole = new UpdateCompanyMemberRole(companies, customers);

  const getMyCompany = new GetMyCompany(companies, customers, websites, customerGroups);
  const listMyCompanyMembers = new ListMyCompanyMembers(companies, customers);
  const addMyCompanyMember = new AddMyCompanyMember(companies, customers);
  const removeMyCompanyMember = new RemoveMyCompanyMember(companies, customers);
  const updateMyCompanyMemberRole = new UpdateMyCompanyMemberRole(companies, customers);

  const setCompanyCreditTerms = new SetCompanyCreditTerms(companies, websites, creditLedger);
  const getCompanyCreditAccount = new GetCompanyCreditAccount(companies, creditLedger);
  const listCompanyCreditTransactions = new ListCompanyCreditTransactions(companies, creditLedger);
  const getCompanyAgingReport = new GetCompanyAgingReport(companies, creditLedger);
  const recordCompanyCreditPayment = new RecordCompanyCreditPayment(companies, creditLedger, orderSettlement);
  const adjustCompanyCredit = new AdjustCompanyCredit(companies, creditLedger);
  const setCompanyCreditAccountStatus = new SetCompanyCreditAccountStatus(companies, creditLedger);
  const getMyCompanyCredit = new GetMyCompanyCredit(companies, customers, creditLedger);

  async function resolveActorId(adminUserPublicId: string | undefined): Promise<bigint | undefined> {
    if (!adminUserPublicId) return undefined;
    return (await adminUsers.findIdByPublicId(adminUserPublicId)) ?? undefined;
  }

  const admin = Router();
  admin.get(
    '/companies',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const query = parse(listCompaniesQuerySchema, req.query);
      res.json({ data: await listCompanies.execute(query) });
    }),
  );
  admin.post(
    '/companies',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createCompanySchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.status(201).json({ data: await createCompany.execute(body, actorId) });
    }),
  );
  admin.get(
    '/companies/:publicId',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getCompany.execute(req.params.publicId!) });
    }),
  );
  admin.put(
    '/companies/:publicId',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCompanySchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await updateCompany.execute(req.params.publicId!, body, actorId) });
    }),
  );
  admin.post(
    '/companies/:publicId/actions/set-status',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(setCompanyStatusSchema, req.body);
      res.json({ data: await setCompanyStatus.execute(req.params.publicId!, body.status) });
    }),
  );
  admin.get(
    '/companies/:publicId/members',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listCompanyMembers.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/companies/:publicId/members',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(addCompanyMemberSchema, req.body);
      res.status(201).json({ data: await addCompanyMember.execute(req.params.publicId!, body) });
    }),
  );
  admin.put(
    '/companies/:publicId/members/:customerPublicId',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCompanyMemberRoleSchema, req.body);
      res.json({ data: await updateCompanyMemberRole.execute(req.params.publicId!, req.params.customerPublicId!, body.role) });
    }),
  );
  admin.delete(
    '/companies/:publicId/members/:customerPublicId',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      await removeCompanyMember.execute(req.params.publicId!, req.params.customerPublicId!);
      res.status(204).send();
    }),
  );

  // plan/15 Phase 7 — B2B Net-X credit terms. No new permission: company:manage covers it.
  admin.get(
    '/companies/:publicId/credit',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getCompanyCreditAccount.execute(req.params.publicId!) });
    }),
  );
  admin.put(
    '/companies/:publicId/credit',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(setCompanyCreditTermsSchema, req.body);
      res.json({ data: await setCompanyCreditTerms.execute(req.params.publicId!, body) });
    }),
  );
  admin.get(
    '/companies/:publicId/credit/transactions',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listCompanyCreditTransactions.execute(req.params.publicId!) });
    }),
  );
  admin.get(
    '/companies/:publicId/credit/aging',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getCompanyAgingReport.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/companies/:publicId/credit/actions/record-payment',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(recordCompanyCreditPaymentSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await recordCompanyCreditPayment.execute(req.params.publicId!, body, actorId) });
    }),
  );
  admin.post(
    '/companies/:publicId/credit/actions/adjust',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(adjustCompanyCreditSchema, req.body);
      const actorId = await resolveActorId(req.adminUser?.adminUserPublicId);
      res.json({ data: await adjustCompanyCredit.execute(req.params.publicId!, body, actorId) });
    }),
  );
  admin.post(
    '/companies/:publicId/credit/actions/set-status',
    authorize('company:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(setCompanyCreditAccountStatusSchema, req.body);
      res.json({ data: await setCompanyCreditAccountStatus.execute(req.params.publicId!, body.status) });
    }),
  );

  const store = Router();
  store.get(
    '/me/company',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getMyCompany.execute(req.customer!.customerPublicId) });
    }),
  );
  store.get(
    '/me/company/members',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await listMyCompanyMembers.execute(req.customer!.customerPublicId) });
    }),
  );
  store.post(
    '/me/company/members',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(addCompanyMemberSchema, req.body);
      res.status(201).json({ data: await addMyCompanyMember.execute(req.customer!.customerPublicId, body) });
    }),
  );
  store.put(
    '/me/company/members/:customerPublicId',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(updateCompanyMemberRoleSchema, req.body);
      res.json({ data: await updateMyCompanyMemberRole.execute(req.customer!.customerPublicId, req.params.customerPublicId!, body.role) });
    }),
  );
  store.delete(
    '/me/company/members/:customerPublicId',
    requireCustomer,
    asyncHandler(async (req, res) => {
      await removeMyCompanyMember.execute(req.customer!.customerPublicId, req.params.customerPublicId!);
      res.status(204).send();
    }),
  );
  store.get(
    '/me/company/credit',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getMyCompanyCredit.execute(req.customer!.customerPublicId) });
    }),
  );

  return { admin, store };
}
