import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCurrencyRepository } from './infrastructure/prisma-currency.repository.js';
import { PrismaWebsiteRepository } from './infrastructure/prisma-website.repository.js';
import { CreateCurrency } from './application/create-currency.usecase.js';
import { UpdateCurrency } from './application/update-currency.usecase.js';
import { ListCurrencies } from './application/list-currencies.usecase.js';
import { DeleteCurrency } from './application/delete-currency.usecase.js';
import { ListWebsites } from './application/list-websites.usecase.js';
import { UpdateWebsiteTaxSettings } from './application/update-website-tax-settings.usecase.js';
import { UpdateWebsiteGeneralSettings } from './application/update-website-general-settings.usecase.js';
import { UpdateWebsiteWalletSettings } from './application/update-website-wallet-settings.usecase.js';
import { RequestWebsiteLogoUpload } from './application/request-logo-upload.usecase.js';
import { GetPublicWebsite } from './application/get-public-website.usecase.js';
import { CreateStore } from './application/create-store.usecase.js';
import { ListPublicStores } from './application/list-public-stores.usecase.js';
import {
  createCurrencySchema,
  updateCurrencySchema,
  updateWebsiteTaxSettingsSchema,
  updateWebsiteGeneralSettingsSchema,
  updateWebsiteWalletSettingsSchema,
  requestLogoUploadSchema,
  getPublicWebsiteQuerySchema,
  createStoreSchema,
} from './interface/http/schemas.js';

export interface StoreRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Store module ("Stores" nav section — General
 *  Settings, Currency Setup, Tax Classes, and GST Settings today; full
 *  Website/Store View management is a deliberate later addition, not built
 *  here). */
export function createStoreModule(db: Db): StoreRouters {
  const currencies = new PrismaCurrencyRepository(db);
  const websites = new PrismaWebsiteRepository(db);

  const createCurrency = new CreateCurrency(currencies);
  const updateCurrency = new UpdateCurrency(currencies);
  const listCurrencies = new ListCurrencies(currencies);
  const deleteCurrency = new DeleteCurrency(currencies);
  const listWebsites = new ListWebsites(websites);
  const updateWebsiteTaxSettings = new UpdateWebsiteTaxSettings(websites);
  const updateWebsiteGeneralSettings = new UpdateWebsiteGeneralSettings(websites);
  const updateWebsiteWalletSettings = new UpdateWebsiteWalletSettings(websites);
  const requestWebsiteLogoUpload = new RequestWebsiteLogoUpload(websites);
  const getPublicWebsite = new GetPublicWebsite(websites);
  const createStore = new CreateStore(websites);
  const listPublicStores = new ListPublicStores(websites);

  const admin = Router();

  admin.post(
    '/currencies',
    asyncHandler(async (req, res) => {
      const body = parse(createCurrencySchema, req.body);
      const view = await createCurrency.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/currencies',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCurrencies.execute() });
    }),
  );

  admin.patch(
    '/currencies/:code',
    asyncHandler(async (req, res) => {
      const body = parse(updateCurrencySchema, req.body);
      const view = await updateCurrency.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.delete(
    '/currencies/:code',
    asyncHandler(async (req, res) => {
      await deleteCurrency.execute(req.params.code!);
      res.status(204).send();
    }),
  );

  admin.get(
    '/websites',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listWebsites.execute() });
    }),
  );

  admin.post(
    '/websites',
    asyncHandler(async (req, res) => {
      const body = parse(createStoreSchema, req.body);
      const view = await createStore.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.patch(
    '/websites/:code/tax-settings',
    asyncHandler(async (req, res) => {
      const body = parse(updateWebsiteTaxSettingsSchema, req.body);
      const view = await updateWebsiteTaxSettings.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.patch(
    '/websites/:code/general-settings',
    asyncHandler(async (req, res) => {
      const body = parse(updateWebsiteGeneralSettingsSchema, req.body);
      const view = await updateWebsiteGeneralSettings.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.patch(
    '/websites/:code/wallet-settings',
    asyncHandler(async (req, res) => {
      const body = parse(updateWebsiteWalletSettingsSchema, req.body);
      const view = await updateWebsiteWalletSettings.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.post(
    '/websites/:code/logo-upload-url',
    asyncHandler(async (req, res) => {
      const body = parse(requestLogoUploadSchema, req.body);
      const result = await requestWebsiteLogoUpload.execute({ code: req.params.code!, ...body });
      res.status(201).json({ data: result });
    }),
  );

  const store = Router();

  store.get(
    '/website',
    asyncHandler(async (req, res) => {
      const query = parse(getPublicWebsiteQuerySchema, req.query);
      res.json({ data: await getPublicWebsite.execute(query.code) });
    }),
  );

  store.get(
    '/websites',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listPublicStores.execute() });
    }),
  );

  return { admin, store };
}
