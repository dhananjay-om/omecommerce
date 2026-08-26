import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCouponRepository } from './infrastructure/prisma-coupon.repository.js';
import { PrismaProductLookup, PrismaCategoryLookup, PrismaAttributeLookup } from './infrastructure/prisma-lookups.js';
import { CreateCoupon } from './application/create-coupon.usecase.js';
import { UpdateCoupon } from './application/update-coupon.usecase.js';
import { ListCoupons } from './application/list-coupons.usecase.js';
import { DeleteCoupon } from './application/delete-coupon.usecase.js';
import { ListApplicableOffers } from './application/list-applicable-offers.usecase.js';
import { createCouponSchema, updateCouponSchema } from './interface/http/schemas.js';

export interface CouponRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Coupon module — admin CRUD, plus ONE real
 *  storefront read (the PDP's "Offers" section). Applying/removing a
 *  coupon at checkout still lives in order.module.ts (it mutates Cart,
 *  Order's own aggregate — order.module.ts imports PrismaCouponRepository
 *  directly as a DiscountCalculator for that); this module's own `store`
 *  router is read-only, never touches Cart/Order. */
export function createCouponModule(db: Db, authorize: (permission: string) => RequestHandler): CouponRouters {
  const coupons = new PrismaCouponRepository(db);
  const products = new PrismaProductLookup(db);
  const categories = new PrismaCategoryLookup(db);
  const attributes = new PrismaAttributeLookup(db);

  const createCoupon = new CreateCoupon(coupons, products, categories, attributes);
  const updateCoupon = new UpdateCoupon(coupons, products, categories, attributes);
  const listCoupons = new ListCoupons(coupons, products, categories, attributes);
  const deleteCoupon = new DeleteCoupon(coupons);
  const listApplicableOffers = new ListApplicableOffers(coupons, products);

  const admin = Router();

  admin.post(
    '/coupons',
    authorize('coupon:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createCouponSchema, req.body);
      const view = await createCoupon.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/coupons',
    authorize('coupon:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCoupons.execute() });
    }),
  );

  admin.patch(
    '/coupons/:code',
    authorize('coupon:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCouponSchema, req.body);
      const view = await updateCoupon.execute({ code: req.params.code!, ...body });
      res.json({ data: view });
    }),
  );

  admin.delete(
    '/coupons/:code',
    authorize('coupon:manage'),
    asyncHandler(async (req, res) => {
      await deleteCoupon.execute(req.params.code!);
      res.status(204).send();
    }),
  );

  const store = Router();
  store.get(
    '/products/:id/offers',
    asyncHandler(async (req, res) => {
      res.json({ data: await listApplicableOffers.execute(req.params.id!) });
    }),
  );

  return { admin, store };
}
