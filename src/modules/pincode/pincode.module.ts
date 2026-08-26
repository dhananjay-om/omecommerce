import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaPincodeRepository } from './infrastructure/prisma-pincode.repository.js';
import { CreatePincode, ListPincodes, UpdatePincode, BulkUpsertPincodes, CheckPincode } from './application/pincode.usecases.js';
import { createPincodeSchema, updatePincodeSchema, listPincodesQuerySchema, bulkUpsertPincodesSchema, pincodeCodeParamSchema } from './interface/http/schemas.js';

export interface PincodeModule {
  admin: Router;
  store: Router;
}

/** Delivery-serviceability lookup (see pincode.prisma's own header
 *  comment). Admin CRUD reuses `catalog:manage` — same "shipping/catalog-
 *  adjacent setting" gate as ShippingMethod/TaxClass admin routes, no new
 *  permission needed. The one storefront route is deliberately public —
 *  checking deliverability is pre-purchase, pre-account, exactly like
 *  browsing the product itself. */
export function createPincodeModule(db: Db, authorize: (permission: string) => RequestHandler): PincodeModule {
  const pincodes = new PrismaPincodeRepository(db);
  const createPincode = new CreatePincode(pincodes);
  const listPincodes = new ListPincodes(pincodes);
  const updatePincode = new UpdatePincode(pincodes);
  const bulkUpsertPincodes = new BulkUpsertPincodes(pincodes);
  const checkPincode = new CheckPincode(pincodes);

  const admin = Router();
  const manage = authorize('catalog:manage');

  admin.get(
    '/pincodes',
    manage,
    asyncHandler(async (req, res) => {
      res.json({ data: await listPincodes.execute(parse(listPincodesQuerySchema, req.query)) });
    }),
  );
  admin.post(
    '/pincodes',
    manage,
    asyncHandler(async (req, res) => {
      const body = parse(createPincodeSchema, req.body);
      res.status(201).json({ data: await createPincode.execute(body) });
    }),
  );
  admin.patch(
    '/pincodes/:code',
    manage,
    asyncHandler(async (req, res) => {
      const body = parse(updatePincodeSchema, req.body);
      res.json({ data: await updatePincode.execute(req.params.code!, body) });
    }),
  );
  admin.post(
    '/pincodes/bulk',
    manage,
    asyncHandler(async (req, res) => {
      const body = parse(bulkUpsertPincodesSchema, req.body);
      res.json({ data: await bulkUpsertPincodes.execute(body) });
    }),
  );

  const store = Router();
  store.get(
    '/pincodes/:code/check',
    asyncHandler(async (req, res) => {
      const code = parse(pincodeCodeParamSchema, req.params.code);
      res.json({ data: await checkPincode.execute(code) });
    }),
  );

  return { admin, store };
}
