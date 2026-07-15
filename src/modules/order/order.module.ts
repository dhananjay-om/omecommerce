import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { PrismaStoreContextResolver } from '../../shared/infrastructure/store-context.repository.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { idempotent } from '../../shared/infrastructure/idempotency/idempotency.middleware.js';
import { PrismaPriceResolver } from '../pricing/infrastructure/prisma-price-resolver.js';
import { PrismaStockLedger } from '../inventory/infrastructure/prisma-stock-ledger.js';
import { PrismaCartRepository } from './infrastructure/prisma-cart.repository.js';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository.js';
import { PrismaVariantLookup, PrismaWarehouseResolver, PrismaCustomerGroupLookup } from './infrastructure/prisma-lookups.js';
import { PrismaTaxClassLookup, NativeTaxCalculator } from './infrastructure/native-tax-calculator.js';
import { NativeShippingCalculator } from './infrastructure/native-shipping-calculator.js';
import { TestPaymentGateway } from './infrastructure/test-payment-gateway.js';
import { PrismaTaxClassRepository, PrismaShippingMethodRepository } from './infrastructure/prisma-setup.repository.js';
import { OutboxWriter } from '../../shared/infrastructure/outbox/outbox-writer.js';
import { CreateCart } from './application/create-cart.usecase.js';
import { AddCartLine } from './application/add-cart-line.usecase.js';
import { CompleteCheckout } from './application/complete-checkout.usecase.js';
import { GetOrder } from './application/get-order.usecase.js';
import { FulfillOrder } from './application/fulfill-order.usecase.js';
import { RefundOrder } from './application/refund-order.usecase.js';
import { CancelOrder } from './application/cancel-order.usecase.js';
import { CreateTaxClass, CreateShippingMethod } from './application/setup.usecases.js';
import {
  createCartSchema,
  addCartLineSchema,
  completeCheckoutSchema,
  fulfillOrderSchema,
  refundOrderSchema,
  createTaxClassSchema,
  createShippingMethodSchema,
} from './interface/http/schemas.js';

export interface OrderRouters {
  admin: Router;
  store: Router;
}

/**
 * Composition root for the Order module. Reuses Inventory's StockLedger and
 * Pricing's PriceResolver directly (see complete-checkout.usecase.ts's header
 * comment for why) rather than duplicating their correctness-critical logic.
 */
export function createOrderModule(db: Db, authorize: (permission: string) => RequestHandler): OrderRouters {
  const storeContext = new PrismaStoreContextResolver(db);
  const priceResolver = new PrismaPriceResolver(db);
  const ledger = new PrismaStockLedger(db);

  const carts = new PrismaCartRepository(db);
  const orders = new PrismaOrderRepository(db);
  const variants = new PrismaVariantLookup(db);
  const warehouses = new PrismaWarehouseResolver(db);
  const customerGroups = new PrismaCustomerGroupLookup(db);
  const taxClassLookup = new PrismaTaxClassLookup(db);
  const taxCalculator = new NativeTaxCalculator(taxClassLookup);
  const shippingCalculator = new NativeShippingCalculator(db);
  const paymentGateway = new TestPaymentGateway();
  const taxClasses = new PrismaTaxClassRepository(db);
  const shippingMethods = new PrismaShippingMethodRepository(db);
  const outbox = new OutboxWriter(db);

  const createCart = new CreateCart(carts, storeContext, customerGroups);
  const addCartLine = new AddCartLine(carts, variants);
  const completeCheckout = new CompleteCheckout(
    carts,
    orders,
    variants,
    storeContext,
    priceResolver,
    ledger,
    warehouses,
    taxCalculator,
    shippingCalculator,
    paymentGateway,
    outbox,
  );
  const getOrder = new GetOrder(orders);
  const fulfillOrder = new FulfillOrder(orders, warehouses);
  const refundOrder = new RefundOrder(orders, ledger, variants, warehouses, outbox);
  const cancelOrder = new CancelOrder(orders, refundOrder, outbox);
  const createTaxClass = new CreateTaxClass(taxClasses);
  const createShippingMethod = new CreateShippingMethod(shippingMethods);

  const admin = Router();
  admin.post(
    '/tax-classes',
    asyncHandler(async (req, res) => {
      const body = parse(createTaxClassSchema, req.body);
      res.status(201).json({ data: await createTaxClass.execute(body) });
    }),
  );
  admin.post(
    '/shipping-methods',
    asyncHandler(async (req, res) => {
      const body = parse(createShippingMethodSchema, req.body);
      res.status(201).json({ data: await createShippingMethod.execute(body) });
    }),
  );
  admin.get(
    '/orders/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrder.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/orders/:publicId/fulfillments',
    asyncHandler(async (req, res) => {
      const body = parse(fulfillOrderSchema, req.body);
      res.json({ data: await fulfillOrder.execute({ orderPublicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.post(
    '/orders/:publicId/refunds',
    authorize('orders:refund'),
    asyncHandler(async (req, res) => {
      const body = parse(refundOrderSchema, req.body);
      res.json({ data: await refundOrder.execute({ orderPublicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.post(
    '/orders/:publicId/cancel',
    authorize('orders:cancel'),
    asyncHandler(async (req, res) => {
      res.json({ data: await cancelOrder.execute({ orderPublicId: req.params.publicId! }) });
    }),
  );

  const store = Router();
  store.post(
    '/carts',
    asyncHandler(async (req, res) => {
      const body = parse(createCartSchema, req.body);
      res.status(201).json({ data: await createCart.execute(body) });
    }),
  );
  store.post(
    '/carts/:publicId/lines',
    asyncHandler(async (req, res) => {
      const body = parse(addCartLineSchema, req.body);
      res.json({ data: await addCartLine.execute({ cartPublicId: req.params.publicId!, ...body }) });
    }),
  );
  store.post(
    '/carts/:publicId/checkout',
    idempotent('POST /store/v1/carts/:publicId/checkout'),
    asyncHandler(async (req, res) => {
      const body = parse(completeCheckoutSchema, req.body);
      res.status(201).json({ data: await completeCheckout.execute({ cartPublicId: req.params.publicId!, ...body }) });
    }),
  );
  store.get(
    '/orders/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrder.execute(req.params.publicId!) });
    }),
  );

  return { admin, store };
}
