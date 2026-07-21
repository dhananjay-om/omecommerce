import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { env } from '../../config/env.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { ScryptPasswordHasher } from '../auth/infrastructure/scrypt-password-hasher.js';
import { PrismaCustomerRepository, PrismaWebsiteLookup } from './infrastructure/prisma-customer.repository.js';
import { PrismaCustomerAddressRepository } from './infrastructure/prisma-customer-address.repository.js';
import { PrismaCustomerOrderLookup } from './infrastructure/prisma-customer-order-lookup.js';
import { JwtCustomerTokenService } from './infrastructure/jwt-customer-token.service.js';
import { RegisterCustomer } from './application/register-customer.usecase.js';
import { LoginCustomer } from './application/login-customer.usecase.js';
import { GetCustomerProfile } from './application/get-customer-profile.usecase.js';
import { AddCustomerAddress, ListCustomerAddresses, DeleteCustomerAddress } from './application/customer-address.usecases.js';
import { ListCustomerOrders } from './application/list-customer-orders.usecase.js';
import { ListCustomers } from './application/list-customers.usecase.js';
import { GetCustomerDetail } from './application/get-customer-detail.usecase.js';
import { authenticateCustomer } from './interface/http/customer.middleware.js';
import {
  registerCustomerSchema,
  loginCustomerSchema,
  addCustomerAddressSchema,
  listCustomersQuerySchema,
  listCustomerOrdersQuerySchema,
} from './interface/http/schemas.js';

export interface CustomerModule {
  /** Unauthenticated + authenticated /store/v1 routes owned by this module. */
  store: Router;
  /** Admin browse routes (list/detail) — first-ever admin surface for this module. */
  admin: Router;
  /** Exported so other storefront modules (e.g. wishlist) can gate their own routes identically. */
  authenticateCustomer: ReturnType<typeof authenticateCustomer>;
}

/**
 * Composition root for storefront Customer accounts (plan/05 §2.5). Deliberately
 * out of scope for this pass (documented deferrals, not silent gaps):
 * - Cart guest->customer merge (plan/05 §2.3's actions/merge) — touches Order
 *   module's cart flow; a follow-up now that Customer exists.
 * - /me/store-credit — blocked on Stage 5 (wallet/store credit).
 * - /me/downloads — blocked on a digital-download system that doesn't exist.
 * - Logout/refresh — stateless 1h JWT, same single-token pattern as admin auth;
 *   no refresh-token rotation built.
 */
export function createCustomerModule(db: Db): CustomerModule {
  const customers = new PrismaCustomerRepository(db);
  const websites = new PrismaWebsiteLookup(db);
  const addresses = new PrismaCustomerAddressRepository(db);
  const orders = new PrismaCustomerOrderLookup(db);
  const hasher = new ScryptPasswordHasher();
  const tokens = new JwtCustomerTokenService(env.JWT_SECRET);

  const registerCustomer = new RegisterCustomer(customers, websites, hasher);
  const loginCustomer = new LoginCustomer(customers, websites, hasher, tokens);
  const getCustomerProfile = new GetCustomerProfile(customers);
  const addCustomerAddress = new AddCustomerAddress(customers, addresses);
  const listCustomerAddresses = new ListCustomerAddresses(customers, addresses);
  const deleteCustomerAddress = new DeleteCustomerAddress(customers, addresses);
  const listCustomerOrders = new ListCustomerOrders(customers, orders);
  const listCustomers = new ListCustomers(customers);
  const getCustomerDetail = new GetCustomerDetail(customers, addresses);

  const requireCustomer = authenticateCustomer(tokens);

  const store = Router();
  store.post(
    '/customers',
    asyncHandler(async (req, res) => {
      const body = parse(registerCustomerSchema, req.body);
      res.status(201).json({ data: await registerCustomer.execute(body) });
    }),
  );
  store.post(
    '/customers/actions/login',
    asyncHandler(async (req, res) => {
      const body = parse(loginCustomerSchema, req.body);
      res.json({ data: await loginCustomer.execute(body) });
    }),
  );
  store.get(
    '/me',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await getCustomerProfile.execute(req.customer!.customerPublicId) });
    }),
  );
  store.get(
    '/me/orders',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const query = parse(listCustomerOrdersQuerySchema, req.query);
      res.json({ data: await listCustomerOrders.execute(req.customer!.customerPublicId, query) });
    }),
  );
  store.get(
    '/me/addresses',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await listCustomerAddresses.execute(req.customer!.customerPublicId) });
    }),
  );
  store.post(
    '/me/addresses',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(addCustomerAddressSchema, req.body);
      res.status(201).json({ data: await addCustomerAddress.execute({ ...body, customerPublicId: req.customer!.customerPublicId }) });
    }),
  );
  store.delete(
    '/me/addresses/:publicId',
    requireCustomer,
    asyncHandler(async (req, res) => {
      await deleteCustomerAddress.execute(req.customer!.customerPublicId, req.params.publicId!);
      res.status(204).send();
    }),
  );

  const admin = Router();
  admin.get(
    '/customers',
    asyncHandler(async (req, res) => {
      const query = parse(listCustomersQuerySchema, req.query);
      res.json({ data: await listCustomers.execute(query) });
    }),
  );
  admin.get(
    '/customers/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getCustomerDetail.execute(req.params.publicId!) });
    }),
  );

  return { store, admin, authenticateCustomer: requireCustomer };
}
