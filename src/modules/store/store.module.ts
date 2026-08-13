import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCurrencyRepository } from './infrastructure/prisma-currency.repository.js';
import { CreateCurrency } from './application/create-currency.usecase.js';
import { UpdateCurrency } from './application/update-currency.usecase.js';
import { ListCurrencies } from './application/list-currencies.usecase.js';
import { createCurrencySchema, updateCurrencySchema } from './interface/http/schemas.js';

export interface StoreRouters {
  admin: Router;
}

/** Composition root for the Store module ("Stores" nav section — Currency Setup today;
 *  Website/Store View management is a deliberate later addition, not built here). */
export function createStoreModule(db: Db): StoreRouters {
  const currencies = new PrismaCurrencyRepository(db);

  const createCurrency = new CreateCurrency(currencies);
  const updateCurrency = new UpdateCurrency(currencies);
  const listCurrencies = new ListCurrencies(currencies);

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

  return { admin };
}
