import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { PrismaStoreContextResolver } from '../../shared/infrastructure/store-context.repository.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { idempotent } from '../../shared/infrastructure/idempotency/idempotency.middleware.js';
import { PrismaPriceResolver } from '../pricing/infrastructure/prisma-price-resolver.js';
import { PrismaStockLedger } from '../inventory/infrastructure/prisma-stock-ledger.js';
import { PrismaCartRepository } from './infrastructure/prisma-cart.repository.js';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository.js';
import {
  PrismaVariantLookup,
  PrismaWarehouseResolver,
  PrismaCustomerGroupLookup,
  PrismaCartProductMediaLookup,
  PrismaAdminUserLookup,
  PrismaCompanyMembershipLookup,
  PrismaCompanyLookup,
  PrismaWalletSettingsLookup,
} from './infrastructure/prisma-lookups.js';
import { PrismaCustomerLookup } from './infrastructure/prisma-customer-lookup.js';
import {
  PrismaTaxClassLookup,
  PrismaWebsiteTaxConfigLookup,
  NativeGstTaxCalculator,
} from './infrastructure/native-tax-calculator.js';
import { NativeShippingCalculator } from './infrastructure/native-shipping-calculator.js';
import { TestPaymentGateway } from './infrastructure/test-payment-gateway.js';
import {
  PrismaTaxClassRepository,
  PrismaShippingMethodRepository,
} from './infrastructure/prisma-setup.repository.js';
import { S3MediaUrlResolver } from './infrastructure/s3-media-url-resolver.js';
import { OutboxWriter } from '../../shared/infrastructure/outbox/outbox-writer.js';
import { EnrichCartView } from './application/enrich-cart-view.js';
import { CreateCart } from './application/create-cart.usecase.js';
import { AttachCustomerToCart } from './application/attach-customer-to-cart.usecase.js';
import { AddCartLine } from './application/add-cart-line.usecase.js';
import { GetCart } from './application/get-cart.usecase.js';
import { RemoveCartLine } from './application/remove-cart-line.usecase.js';
import { CompleteCheckout } from './application/complete-checkout.usecase.js';
import { GetOrder } from './application/get-order.usecase.js';
import { ListOrders } from './application/list-orders.usecase.js';
import { FulfillOrder } from './application/fulfill-order.usecase.js';
import { RefundOrder } from './application/refund-order.usecase.js';
import { CancelOrder } from './application/cancel-order.usecase.js';
import {
  CreateTaxClass,
  ListTaxClasses,
  UpdateTaxClass,
  DeleteTaxClass,
  CreateShippingMethod,
  ListShippingMethodsAdmin,
  UpdateShippingMethod,
  DeleteShippingMethod,
} from './application/setup.usecases.js';
import { ListShippingMethods } from './application/list-shipping-methods.usecase.js';
import { GetOrderHistory } from './application/get-order-history.usecase.js';
import { AddOrderNote } from './application/add-order-note.usecase.js';
import { CreateInvoice } from './application/create-invoice.usecase.js';
import { ListInvoices } from './application/list-invoices.usecase.js';
import { GetInvoice } from './application/get-invoice.usecase.js';
import { GetInvoicePdfUrl } from './application/get-invoice-pdf-url.usecase.js';
import { RegenerateInvoice } from './application/regenerate-invoice.usecase.js';
import { GetPackingSlipPdfUrl } from './application/get-packing-slip-pdf-url.usecase.js';
import { SendOrderEmail } from './application/send-order-email.usecase.js';
import { GetEmailLog } from './application/get-email-log.usecase.js';
import { SimulatedEmailSender } from './infrastructure/simulated-email-sender.js';
import { CloseOrder } from './application/close-order.usecase.js';
import { ExportOrders } from './application/export-orders.usecase.js';
import { GetCustomerOrder } from './application/get-customer-order.usecase.js';
import { GetCustomerOrderInvoicePdfUrl } from './application/get-customer-order-invoice-pdf-url.usecase.js';
import { GetCustomerOrderTracking } from './application/get-customer-order-tracking.usecase.js';
import { Reorder } from './application/reorder.usecase.js';
import { PuppeteerPdfRenderer } from './infrastructure/puppeteer-pdf-renderer.js';
import { S3PdfStorage } from './infrastructure/s3-pdf-storage.js';
import { PrismaWalletLedger } from '../wallet/infrastructure/prisma-wallet-ledger.js';
import { PrismaCustomerContextLookup } from '../wallet/infrastructure/prisma-customer-context-lookup.js';
import { CreditWallet } from '../wallet/application/credit-wallet.usecase.js';
import { PrismaGiftCardLedger } from '../giftcard/infrastructure/prisma-giftcard-ledger.js';
import { PrismaCouponRepository } from '../coupon/infrastructure/prisma-coupon.repository.js';
import { PrismaCompanyCreditLedger } from '../company/infrastructure/prisma-company-credit-ledger.js';
import { ApplyCouponToCart } from './application/apply-coupon-to-cart.usecase.js';
import { RemoveCouponFromCart } from './application/remove-coupon-from-cart.usecase.js';
import { ApplyGiftCardToCart } from './application/apply-gift-card-to-cart.usecase.js';
import { RemoveGiftCardFromCart } from './application/remove-gift-card-from-cart.usecase.js';
import { ApplyWalletToCart } from './application/apply-wallet-to-cart.usecase.js';
import { RemoveWalletFromCart } from './application/remove-wallet-from-cart.usecase.js';
import { ApplyCreditTermsToCart } from './application/apply-credit-terms-to-cart.usecase.js';
import { RemoveCreditTermsFromCart } from './application/remove-credit-terms-from-cart.usecase.js';
import {
  createCartSchema,
  addCartLineSchema,
  applyGiftCardToCartSchema,
  removeGiftCardFromCartSchema,
  completeCheckoutSchema,
  fulfillOrderSchema,
  refundOrderSchema,
  cancelOrderSchema,
  addOrderNoteSchema,
  createInvoiceSchema,
  sendOrderEmailSchema,
  createTaxClassSchema,
  updateTaxClassSchema,
  createShippingMethodSchema,
  updateShippingMethodSchema,
  listOrdersQuerySchema,
  exportOrdersQuerySchema,
} from './interface/http/schemas.js';
import { applyCouponSchema } from '../coupon/interface/http/schemas.js';

export interface OrderRouters {
  admin: Router;
  store: Router;
}

/**
 * Composition root for the Order module. Reuses Inventory's StockLedger and
 * Pricing's PriceResolver directly (see complete-checkout.usecase.ts's header
 * comment for why) rather than duplicating their correctness-critical logic.
 */
export function createOrderModule(
  db: Db,
  authorize: (permission: string) => RequestHandler,
  requireCustomer: RequestHandler,
  giftCardHmacSecret: string,
): OrderRouters {
  const storeContext = new PrismaStoreContextResolver(db);
  const priceResolver = new PrismaPriceResolver(db);
  const ledger = new PrismaStockLedger(db);

  const carts = new PrismaCartRepository(db);
  const orders = new PrismaOrderRepository(db);
  const variants = new PrismaVariantLookup(db);
  const warehouses = new PrismaWarehouseResolver(db);
  const customerGroups = new PrismaCustomerGroupLookup(db);
  const customers = new PrismaCustomerLookup(db);
  const adminUsers = new PrismaAdminUserLookup(db);
  const companyMemberships = new PrismaCompanyMembershipLookup(db);
  const companies = new PrismaCompanyLookup(db);
  // Own instance, same "correctness-critical shared logic, imported not
  // reimplemented" carve-out as StockLedger/PriceResolver/WalletLedger above
  // — used both for cart tender preview (EnrichCartView) and checkout-time
  // charging (CompleteCheckout) below.
  const companyCredit = new PrismaCompanyCreditLedger(db);
  const taxClassLookup = new PrismaTaxClassLookup(db);
  const websiteTaxConfigLookup = new PrismaWebsiteTaxConfigLookup(db);
  const taxCalculator = new NativeGstTaxCalculator(taxClassLookup, websiteTaxConfigLookup);
  const shippingCalculator = new NativeShippingCalculator(db);
  const paymentGateway = new TestPaymentGateway();
  const taxClasses = new PrismaTaxClassRepository(db);
  const shippingMethods = new PrismaShippingMethodRepository(db);
  const outbox = new OutboxWriter(db);
  const cartProductMedia = new PrismaCartProductMediaLookup(db);
  const mediaUrlResolver = new S3MediaUrlResolver();
  // Own instance, same reasoning as the wallet ledger above — Order composes
  // coupon's infrastructure directly rather than importing coupon.module.ts's
  // factory (that factory also wires coupon's admin HTTP routes, which Order
  // has no business constructing).
  const discountCalculator = new PrismaCouponRepository(db);
  // Own instances, same "correctness-critical shared logic, imported not
  // reimplemented" carve-out as StockLedger/PriceResolver above — used both
  // for cart tender preview (EnrichCartView) and checkout-time hold
  // placement (CompleteCheckout) below.
  const walletLedger = new PrismaWalletLedger(db);
  const giftCardLedger = new PrismaGiftCardLedger(db);
  // Own instance, same "correctness-critical shared logic" carve-out as
  // companyCredit above — used both for cart tender preview (EnrichCartView)
  // and checkout-time capping (CompleteCheckout) below.
  const walletSettings = new PrismaWalletSettingsLookup(db);
  const enrichCartView = new EnrichCartView(
    variants,
    priceResolver,
    cartProductMedia,
    mediaUrlResolver,
    discountCalculator,
    websiteTaxConfigLookup,
    taxClassLookup,
    walletLedger,
    giftCardLedger,
    customerGroups,
    companyCredit,
    companyMemberships,
    walletSettings,
  );

  const createCart = new CreateCart(
    carts,
    storeContext,
    customerGroups,
    customers,
    companyMemberships,
    enrichCartView,
  );
  const attachCustomerToCart = new AttachCustomerToCart(
    carts,
    customerGroups,
    customers,
    companyMemberships,
    enrichCartView,
  );
  const addCartLine = new AddCartLine(carts, variants, enrichCartView);
  const getCart = new GetCart(carts, enrichCartView);
  const removeCartLine = new RemoveCartLine(carts, variants, enrichCartView);
  const applyCouponToCart = new ApplyCouponToCart(
    carts,
    variants,
    discountCalculator,
    enrichCartView,
  );
  const removeCouponFromCart = new RemoveCouponFromCart(carts, enrichCartView);
  const applyGiftCardToCart = new ApplyGiftCardToCart(
    carts,
    giftCardLedger,
    enrichCartView,
    giftCardHmacSecret,
  );
  const removeGiftCardFromCart = new RemoveGiftCardFromCart(carts, giftCardLedger, enrichCartView);
  const applyWalletToCart = new ApplyWalletToCart(carts, customers, enrichCartView);
  const removeWalletFromCart = new RemoveWalletFromCart(carts, customers, enrichCartView);
  const applyCreditTermsToCart = new ApplyCreditTermsToCart(carts, customers, enrichCartView);
  const removeCreditTermsFromCart = new RemoveCreditTermsFromCart(carts, customers, enrichCartView);
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
    discountCalculator,
    walletLedger,
    giftCardLedger,
    companyMemberships,
    companyCredit,
    walletSettings,
  );
  const getOrder = new GetOrder(orders, companies);
  const listOrders = new ListOrders(orders);
  const listShippingMethods = new ListShippingMethods(shippingMethods);
  // walletLedger is already constructed above (shared with EnrichCartView).
  // Own instance of the customer-context lookup — CreditWallet is reused
  // directly (money-moving ledger write, the correctness-critical carve-out),
  // not re-implemented, but Order still composes its own copy here rather
  // than importing wallet.module.ts's factory (that factory also wires
  // wallet's HTTP routes, which Order has no business constructing).
  const walletCustomerContext = new PrismaCustomerContextLookup(db);
  const creditWallet = new CreditWallet(walletLedger, walletCustomerContext);

  const pdfRenderer = new PuppeteerPdfRenderer();
  const pdfStorage = new S3PdfStorage();
  const fulfillOrder = new FulfillOrder(orders, warehouses, outbox, pdfRenderer, pdfStorage);
  const refundOrder = new RefundOrder(
    orders,
    ledger,
    variants,
    warehouses,
    outbox,
    customers,
    creditWallet,
    walletLedger,
    giftCardLedger,
    companyCredit,
  );
  const cancelOrder = new CancelOrder(orders, refundOrder, outbox);
  const createTaxClass = new CreateTaxClass(taxClasses);
  const listTaxClasses = new ListTaxClasses(taxClasses);
  const updateTaxClass = new UpdateTaxClass(taxClasses);
  const deleteTaxClass = new DeleteTaxClass(taxClasses);
  const createShippingMethod = new CreateShippingMethod(shippingMethods);
  const listShippingMethodsAdmin = new ListShippingMethodsAdmin(shippingMethods);
  const updateShippingMethod = new UpdateShippingMethod(shippingMethods);
  const deleteShippingMethod = new DeleteShippingMethod(shippingMethods);
  const getOrderHistory = new GetOrderHistory(orders);
  const addOrderNote = new AddOrderNote(orders, adminUsers);
  const createInvoice = new CreateInvoice(
    orders,
    adminUsers,
    pdfRenderer,
    pdfStorage,
    websiteTaxConfigLookup,
  );
  const listInvoices = new ListInvoices(orders);
  const getInvoice = new GetInvoice(orders);
  const getInvoicePdfUrl = new GetInvoicePdfUrl(orders, mediaUrlResolver);
  const regenerateInvoice = new RegenerateInvoice(
    orders,
    pdfRenderer,
    pdfStorage,
    websiteTaxConfigLookup,
  );
  const getPackingSlipPdfUrl = new GetPackingSlipPdfUrl(orders, mediaUrlResolver);
  const emailSender = new SimulatedEmailSender();
  const sendOrderEmail = new SendOrderEmail(orders, adminUsers, emailSender);
  const getEmailLog = new GetEmailLog(orders);
  const closeOrder = new CloseOrder(orders, outbox);
  const exportOrders = new ExportOrders(orders);
  const getCustomerOrder = new GetCustomerOrder(orders, customers, companies);
  const getCustomerOrderInvoicePdfUrl = new GetCustomerOrderInvoicePdfUrl(
    orders,
    customers,
    mediaUrlResolver,
  );
  const getCustomerOrderTracking = new GetCustomerOrderTracking(orders, customers);
  const reorder = new Reorder(orders, customers, variants, carts);

  const admin = Router();
  admin.post(
    '/tax-classes',
    asyncHandler(async (req, res) => {
      const body = parse(createTaxClassSchema, req.body);
      res.status(201).json({ data: await createTaxClass.execute(body) });
    }),
  );
  admin.get(
    '/tax-classes',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listTaxClasses.execute() });
    }),
  );
  admin.patch(
    '/tax-classes/:code',
    asyncHandler(async (req, res) => {
      const body = parse(updateTaxClassSchema, req.body);
      res.json({ data: await updateTaxClass.execute(req.params.code!, body) });
    }),
  );
  admin.delete(
    '/tax-classes/:code',
    asyncHandler(async (req, res) => {
      await deleteTaxClass.execute(req.params.code!);
      res.status(204).send();
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
    '/shipping-methods',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listShippingMethodsAdmin.execute() });
    }),
  );
  admin.patch(
    '/shipping-methods/:code',
    asyncHandler(async (req, res) => {
      const body = parse(updateShippingMethodSchema, req.body);
      res.json({ data: await updateShippingMethod.execute(req.params.code!, body) });
    }),
  );
  admin.delete(
    '/shipping-methods/:code',
    asyncHandler(async (req, res) => {
      await deleteShippingMethod.execute(req.params.code!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/orders',
    authorize('orders:view'),
    asyncHandler(async (req, res) => {
      const query = parse(listOrdersQuerySchema, req.query);
      res.json({ data: await listOrders.execute(query) });
    }),
  );
  admin.get(
    '/orders/export',
    authorize('orders:export'),
    asyncHandler(async (req, res) => {
      const { format, ...filter } = parse(exportOrdersQuerySchema, req.query);
      const result = await exportOrders.execute(filter, format ?? 'csv');
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
      res.send(result.buffer);
    }),
  );
  admin.get(
    '/orders/:publicId',
    authorize('orders:view'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrder.execute(req.params.publicId!) });
    }),
  );
  admin.get(
    '/orders/:publicId/history',
    authorize('orders:view'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrderHistory.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/orders/:publicId/notes',
    authorize('orders:view'),
    asyncHandler(async (req, res) => {
      const body = parse(addOrderNoteSchema, req.body);
      res
        .status(201)
        .json({
          data: await addOrderNote.execute({
            orderPublicId: req.params.publicId!,
            createdBy: req.adminUser?.adminUserPublicId,
            ...body,
          }),
        });
    }),
  );
  admin.post(
    '/orders/:publicId/fulfillments',
    authorize('orders:fulfill'),
    asyncHandler(async (req, res) => {
      const body = parse(fulfillOrderSchema, req.body);
      res.json({
        data: await fulfillOrder.execute({ orderPublicId: req.params.publicId!, ...body }),
      });
    }),
  );
  admin.get(
    '/orders/:publicId/shipment/:fulfillmentId/packing-slip',
    authorize('orders:fulfill'),
    asyncHandler(async (req, res) => {
      const url = await getPackingSlipPdfUrl.execute(
        req.params.publicId!,
        req.params.fulfillmentId!,
      );
      res.redirect(302, url);
    }),
  );
  admin.post(
    '/orders/:publicId/refunds',
    authorize('orders:refund'),
    asyncHandler(async (req, res) => {
      const body = parse(refundOrderSchema, req.body);
      res.json({
        data: await refundOrder.execute({ orderPublicId: req.params.publicId!, ...body }),
      });
    }),
  );
  admin.post(
    '/orders/:publicId/cancel',
    authorize('orders:cancel'),
    asyncHandler(async (req, res) => {
      const body = parse(cancelOrderSchema, req.body);
      res.json({
        data: await cancelOrder.execute({ orderPublicId: req.params.publicId!, ...body }),
      });
    }),
  );
  admin.post(
    '/orders/:publicId/invoice',
    authorize('orders:invoice'),
    asyncHandler(async (req, res) => {
      const body = parse(createInvoiceSchema, req.body);
      res
        .status(201)
        .json({
          data: await createInvoice.execute({
            orderPublicId: req.params.publicId!,
            createdBy: req.adminUser?.adminUserPublicId,
            ...body,
          }),
        });
    }),
  );
  admin.get(
    '/orders/:publicId/invoices',
    authorize('orders:invoice'),
    asyncHandler(async (req, res) => {
      res.json({ data: await listInvoices.execute(req.params.publicId!) });
    }),
  );
  admin.get(
    '/orders/:publicId/invoice/:invoiceId',
    authorize('orders:invoice'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getInvoice.execute(req.params.publicId!, req.params.invoiceId!) });
    }),
  );
  admin.get(
    '/orders/:publicId/invoice/:invoiceId/pdf',
    authorize('orders:invoice'),
    asyncHandler(async (req, res) => {
      const url = await getInvoicePdfUrl.execute(req.params.publicId!, req.params.invoiceId!);
      res.redirect(302, url);
    }),
  );
  admin.post(
    '/orders/:publicId/invoice/:invoiceId/regenerate',
    authorize('orders:invoice'),
    asyncHandler(async (req, res) => {
      res.json({
        data: await regenerateInvoice.execute(req.params.publicId!, req.params.invoiceId!),
      });
    }),
  );
  admin.post(
    '/orders/:publicId/send-email',
    authorize('orders:email'),
    asyncHandler(async (req, res) => {
      const body = parse(sendOrderEmailSchema, req.body);
      res
        .status(201)
        .json({
          data: await sendOrderEmail.execute({
            orderPublicId: req.params.publicId!,
            sentBy: req.adminUser?.adminUserPublicId,
            ...body,
          }),
        });
    }),
  );
  admin.get(
    '/orders/:publicId/email-log',
    authorize('orders:email'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getEmailLog.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/orders/:publicId/close',
    authorize('orders:close'),
    asyncHandler(async (req, res) => {
      res.json({ data: await closeOrder.execute(req.params.publicId!) });
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
  store.get(
    '/carts/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getCart.execute(req.params.publicId!) });
    }),
  );
  store.post(
    '/carts/:publicId/lines',
    asyncHandler(async (req, res) => {
      const body = parse(addCartLineSchema, req.body);
      res.json({
        data: await addCartLine.execute({ cartPublicId: req.params.publicId!, ...body }),
      });
    }),
  );
  store.delete(
    '/carts/:publicId/lines/:variantId',
    asyncHandler(async (req, res) => {
      res.json({
        data: await removeCartLine.execute({
          cartPublicId: req.params.publicId!,
          variantId: req.params.variantId!,
        }),
      });
    }),
  );
  store.post(
    '/carts/:publicId/actions/apply-coupon',
    asyncHandler(async (req, res) => {
      const body = parse(applyCouponSchema, req.body);
      res.json({
        data: await applyCouponToCart.execute({
          cartPublicId: req.params.publicId!,
          code: body.code,
        }),
      });
    }),
  );
  store.post(
    '/carts/:publicId/actions/remove-coupon',
    asyncHandler(async (req, res) => {
      res.json({
        data: await removeCouponFromCart.execute({ cartPublicId: req.params.publicId! }),
      });
    }),
  );
  // Unauthenticated, bearer-code trust — same level as ApplyCouponToCart and
  // the gift card balance-check route (plan/15 Phase 5).
  store.post(
    '/carts/:publicId/actions/apply-gift-card',
    asyncHandler(async (req, res) => {
      const body = parse(applyGiftCardToCartSchema, req.body);
      res.json({
        data: await applyGiftCardToCart.execute({
          cartPublicId: req.params.publicId!,
          code: body.code,
        }),
      });
    }),
  );
  store.post(
    '/carts/:publicId/actions/remove-gift-card',
    asyncHandler(async (req, res) => {
      const body = parse(removeGiftCardFromCartSchema, req.body);
      res.json({
        data: await removeGiftCardFromCart.execute({
          cartPublicId: req.params.publicId!,
          giftCardPublicId: body.giftCardPublicId,
        }),
      });
    }),
  );
  // requireCustomer + ownership-checked — unlike gift cards, a wallet tender
  // has no bearer secret, so it's gated on the caller's own session.
  store.post(
    '/carts/:publicId/actions/apply-wallet',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await applyWalletToCart.execute({
          cartPublicId: req.params.publicId!,
          customerPublicId: req.customer!.customerPublicId,
        }),
      });
    }),
  );
  store.post(
    '/carts/:publicId/actions/remove-wallet',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await removeWalletFromCart.execute({
          cartPublicId: req.params.publicId!,
          customerPublicId: req.customer!.customerPublicId,
        }),
      });
    }),
  );
  // requireCustomer + ownership-checked — same shape as wallet (plan/15 Phase 7).
  store.post(
    '/carts/:publicId/actions/apply-credit-terms',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await applyCreditTermsToCart.execute({
          cartPublicId: req.params.publicId!,
          customerPublicId: req.customer!.customerPublicId,
        }),
      });
    }),
  );
  store.post(
    '/carts/:publicId/actions/remove-credit-terms',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await removeCreditTermsFromCart.execute({
          cartPublicId: req.params.publicId!,
          customerPublicId: req.customer!.customerPublicId,
        }),
      });
    }),
  );
  // plan/15 Phase 6 — claims a guest cart at login and re-derives its
  // pricing group; failures are expected to be swallowed by the caller
  // (see AttachCustomerToCart's doc comment).
  store.post(
    '/carts/:publicId/actions/attach-customer',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await attachCustomerToCart.execute(
          req.params.publicId!,
          req.customer!.customerPublicId,
        ),
      });
    }),
  );
  store.post(
    '/carts/:publicId/checkout',
    idempotent('POST /store/v1/carts/:publicId/checkout'),
    asyncHandler(async (req, res) => {
      const body = parse(completeCheckoutSchema, req.body);
      res
        .status(201)
        .json({
          data: await completeCheckout.execute({
            cartPublicId: req.params.publicId!,
            customerIp: req.ip,
            ...body,
          }),
        });
    }),
  );
  store.get(
    '/shipping-methods',
    asyncHandler(async (req, res) => {
      const currency = typeof req.query.currency === 'string' ? req.query.currency : 'USD';
      res.json({ data: await listShippingMethods.execute(currency) });
    }),
  );
  store.get(
    '/orders/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrder.execute(req.params.publicId!) });
    }),
  );
  store.get(
    '/me/orders/:publicId',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await getCustomerOrder.execute(req.customer!.customerPublicId, req.params.publicId!),
      });
    }),
  );
  store.get(
    '/me/orders/:publicId/invoice',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const url = await getCustomerOrderInvoicePdfUrl.execute(
        req.customer!.customerPublicId,
        req.params.publicId!,
      );
      res.redirect(302, url);
    }),
  );
  store.get(
    '/me/orders/:publicId/tracking',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await getCustomerOrderTracking.execute(
          req.customer!.customerPublicId,
          req.params.publicId!,
        ),
      });
    }),
  );
  store.post(
    '/me/orders/:publicId/reorder',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({
        data: await reorder.execute(req.customer!.customerPublicId, req.params.publicId!),
      });
    }),
  );

  return { admin, store };
}
