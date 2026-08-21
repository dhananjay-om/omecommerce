import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { OutboxWriter } from '../../shared/infrastructure/outbox/outbox-writer.js';
import {
  PrismaCustomerGroupRepository,
  PrismaVariantLookup,
  PrismaWebsiteLookup,
  PrismaCurrencyLookup,
} from './infrastructure/prisma-customer-group.repository.js';
import { PrismaPriceListRepository } from './infrastructure/prisma-price-list.repository.js';
import { PrismaPriceResolver } from './infrastructure/prisma-price-resolver.js';
import { CreateCustomerGroup } from './application/create-customer-group.usecase.js';
import { ListCustomerGroups } from './application/list-customer-groups.usecase.js';
import { CreatePriceList } from './application/create-price-list.usecase.js';
import { UpdatePriceList } from './application/update-price-list.usecase.js';
import { DeletePriceList } from './application/delete-price-list.usecase.js';
import { ListPriceLists } from './application/list-price-lists.usecase.js';
import { SetProductPrice } from './application/set-product-price.usecase.js';
import { SetPriceTier } from './application/set-price-tier.usecase.js';
import { ResolvePrice } from './application/resolve-price.usecase.js';
import { ListVariantPrices } from './application/list-variant-prices.usecase.js';
import {
  createCustomerGroupSchema,
  createPriceListSchema,
  updatePriceListSchema,
  setProductPriceSchema,
  setPriceTierSchema,
  resolvePriceQuerySchema,
} from './interface/http/schemas.js';

export interface PricingRouters {
  admin: Router;
}

/** Composition root for the Pricing module — wires ports to Prisma adapters. */
export function createPricingModule(db: Db): PricingRouters {
  const customerGroups = new PrismaCustomerGroupRepository(db);
  const variants = new PrismaVariantLookup(db);
  const websites = new PrismaWebsiteLookup(db);
  const currencies = new PrismaCurrencyLookup(db);
  const priceLists = new PrismaPriceListRepository(db);
  const resolver = new PrismaPriceResolver(db);
  const outbox = new OutboxWriter(db);

  const createCustomerGroup = new CreateCustomerGroup(customerGroups);
  const listCustomerGroups = new ListCustomerGroups(customerGroups);
  const createPriceList = new CreatePriceList(priceLists, customerGroups, websites, currencies);
  const updatePriceList = new UpdatePriceList(priceLists, currencies);
  const deletePriceList = new DeletePriceList(priceLists);
  const listPriceLists = new ListPriceLists(priceLists);
  const setProductPrice = new SetProductPrice(priceLists, variants, outbox);
  const setPriceTier = new SetPriceTier(priceLists, variants);
  const resolvePrice = new ResolvePrice(resolver, variants, customerGroups, websites);
  const listVariantPrices = new ListVariantPrices(priceLists, variants);

  const admin = Router();

  admin.post(
    '/customer-groups',
    asyncHandler(async (req, res) => {
      const body = parse(createCustomerGroupSchema, req.body);
      const view = await createCustomerGroup.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/customer-groups',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCustomerGroups.execute() });
    }),
  );

  admin.post(
    '/price-lists',
    asyncHandler(async (req, res) => {
      const body = parse(createPriceListSchema, req.body);
      const view = await createPriceList.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/price-lists',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listPriceLists.execute() });
    }),
  );

  admin.patch(
    '/price-lists/:code',
    asyncHandler(async (req, res) => {
      const body = parse(updatePriceListSchema, req.body);
      const view = await updatePriceList.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.delete(
    '/price-lists/:code',
    asyncHandler(async (req, res) => {
      await deletePriceList.execute(req.params.code!);
      res.status(204).send();
    }),
  );

  admin.put(
    '/price-lists/:code/prices',
    asyncHandler(async (req, res) => {
      const body = parse(setProductPriceSchema, req.body);
      await setProductPrice.execute({
        priceListCode: req.params.code!,
        variantPublicId: body.variantId,
        price: body.price,
        mrp: body.mrp,
      });
      res.status(204).send();
    }),
  );

  admin.put(
    '/price-lists/:code/tiers',
    asyncHandler(async (req, res) => {
      const body = parse(setPriceTierSchema, req.body);
      await setPriceTier.execute({
        priceListCode: req.params.code!,
        variantPublicId: body.variantId,
        minQty: body.minQty,
        price: body.price,
      });
      res.status(204).send();
    }),
  );

  admin.get(
    '/variants/:variantId/prices',
    asyncHandler(async (req, res) => {
      res.json({ data: await listVariantPrices.execute(req.params.variantId!) });
    }),
  );

  admin.get(
    '/pricing/resolve',
    asyncHandler(async (req, res) => {
      const query = parse(resolvePriceQuerySchema, req.query);
      const view = await resolvePrice.execute({
        variantPublicId: query.variantId,
        qty: query.qty,
        currency: query.currency,
        customerGroupCode: query.customerGroupCode,
        websiteCode: query.websiteCode,
      });
      res.json({ data: view });
    }),
  );

  return { admin };
}
