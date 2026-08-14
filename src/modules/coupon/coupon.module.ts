import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCouponRepository } from './infrastructure/prisma-coupon.repository.js';
import { PrismaProductLookup, PrismaCategoryLookup, PrismaAttributeLookup } from './infrastructure/prisma-lookups.js';
import { CreateCoupon } from './application/create-coupon.usecase.js';
import { UpdateCoupon } from './application/update-coupon.usecase.js';
import { ListCoupons } from './application/list-coupons.usecase.js';
import { DeleteCoupon } from './application/delete-coupon.usecase.js';
import { createCouponSchema, updateCouponSchema } from './interface/http/schemas.js';

export interface CouponRouters {
  admin: Router;
}

/** Composition root for the Coupon module — admin CRUD only. The store-facing
 *  apply/remove-coupon routes live in order.module.ts instead: they mutate Cart,
 *  Order's own aggregate, the same reasoning AddCartLine/RemoveCartLine already
 *  follow. order.module.ts imports PrismaCouponRepository directly (as a
 *  DiscountCalculator) to power those routes and the checkout saga. */
export function createCouponModule(db: Db, authorize: (permission: string) => RequestHandler): CouponRouters {
  const coupons = new PrismaCouponRepository(db);
  const products = new PrismaProductLookup(db);
  const categories = new PrismaCategoryLookup(db);
  const attributes = new PrismaAttributeLookup(db);

  const createCoupon = new CreateCoupon(coupons, products, categories, attributes);
  const updateCoupon = new UpdateCoupon(coupons, products, categories, attributes);
  const listCoupons = new ListCoupons(coupons, products, categories, attributes);
  const deleteCoupon = new DeleteCoupon(coupons);

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

  return { admin };
}
