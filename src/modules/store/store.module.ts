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
import { RequestWebsiteLogoUpload } from './application/request-logo-upload.usecase.js';
import { createCurrencySchema, updateCurrencySchema, updateWebsiteTaxSettingsSchema, requestLogoUploadSchema } from './interface/http/schemas.js';

export interface StoreRouters {
  admin: Router;
}

/** Composition root for the Store module ("Stores" nav section — Currency Setup
 *  and GST Settings today; full Website/Store View management is a deliberate
 *  later addition, not built here). */
export function createStoreModule(db: Db): StoreRouters {
  const currencies = new PrismaCurrencyRepository(db);
  const websites = new PrismaWebsiteRepository(db);

  const createCurrency = new CreateCurrency(currencies);
  const updateCurrency = new UpdateCurrency(currencies);
  const listCurrencies = new ListCurrencies(currencies);
  const deleteCurrency = new DeleteCurrency(currencies);
  const listWebsites = new ListWebsites(websites);
  const updateWebsiteTaxSettings = new UpdateWebsiteTaxSettings(websites);
  const requestWebsiteLogoUpload = new RequestWebsiteLogoUpload(websites);

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

  admin.patch(
    '/websites/:code/tax-settings',
    asyncHandler(async (req, res) => {
      const body = parse(updateWebsiteTaxSettingsSchema, req.body);
      const view = await updateWebsiteTaxSettings.execute({ code: req.params.code!, ...body });
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

  return { admin };
}
