import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './shared/infrastructure/logger.js';
import { env } from './config/env.js';
import { installBigIntJson } from './shared/interface/http/serialization.js';
import { requestContext, notFound, errorHandler } from './shared/interface/http/middleware.js';
import { healthRouter } from './shared/interface/http/health.route.js';
import { prisma } from './shared/infrastructure/prisma/client.js';
import { redis } from './shared/infrastructure/redis/client.js';
import { createCatalogModule } from './modules/catalog/catalog.module.js';
import { createInventoryModule } from './modules/inventory/inventory.module.js';
import { createPricingModule } from './modules/pricing/pricing.module.js';
import { createOrderModule } from './modules/order/order.module.js';
import { createAuthModule } from './modules/auth/auth.module.js';
import { createSearchModule } from './modules/search/search.module.js';
import { createCustomerModule } from './modules/customer/customer.module.js';
import { createWishlistModule } from './modules/wishlist/wishlist.module.js';
import { createCmsModule } from './modules/cms/cms.module.js';
import { createWalletModule } from './modules/wallet/wallet.module.js';
import { createGiftCardModule } from './modules/giftcard/giftcard.module.js';
import { createLoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { createReferralModule } from './modules/referral/referral.module.js';

/**
 * Builds the Express app WITHOUT starting the server, so tests can import it directly.
 * Module routers (catalog, inventory, ...) get mounted here as they are built.
 */
export function createApp(): Express {
  installBigIntJson();
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);

  // Health / readiness
  app.use(healthRouter);

  // Auth: login is public; everything else under /admin/v1 requires a valid
  // token (plan/12 §5 "Auth/RBAC before public write endpoints"). Mounting
  // order matters here — `auth.public` handles /auth/login itself before the
  // `authenticate` middleware below ever runs for that path.
  const auth = createAuthModule(prisma);
  app.use('/admin/v1', auth.public);
  app.use('/admin/v1', auth.authenticate);
  app.use('/admin/v1', auth.admin);

  // Modules
  const catalog = createCatalogModule(prisma, redis, auth.authorize);
  app.use('/admin/v1', catalog.admin);
  app.use('/store/v1', catalog.store);

  const inventory = createInventoryModule(prisma, auth.authorize);
  app.use('/admin/v1', inventory.admin);

  const pricing = createPricingModule(prisma);
  app.use('/admin/v1', pricing.admin);

  const order = createOrderModule(prisma, auth.authorize);
  app.use('/admin/v1', order.admin);
  app.use('/store/v1', order.store);

  const search = createSearchModule(prisma, auth.authorize);
  app.use('/admin/v1', search.admin);
  app.use('/store/v1', search.store);

  const customer = createCustomerModule(prisma);
  app.use('/admin/v1', customer.admin);
  app.use('/store/v1', customer.store);

  const wishlist = createWishlistModule(prisma, customer.authenticateCustomer);
  app.use('/store/v1', wishlist.store);

  const cms = createCmsModule(prisma, auth.authorize);
  app.use('/admin/v1', cms.admin);
  app.use('/store/v1', cms.store);

  const wallet = createWalletModule(prisma, auth.authorize, customer.authenticateCustomer);
  app.use('/admin/v1', wallet.admin);
  app.use('/store/v1', wallet.store);

  const giftcard = createGiftCardModule(prisma, env.GIFT_CARD_HMAC_SECRET, auth.authorize, customer.authenticateCustomer);
  app.use('/admin/v1', giftcard.admin);
  app.use('/store/v1', giftcard.store);

  const loyalty = createLoyaltyModule(prisma, auth.authorize, customer.authenticateCustomer);
  app.use('/admin/v1', loyalty.admin);
  app.use('/store/v1', loyalty.store);

  const referral = createReferralModule(prisma, auth.authorize, customer.authenticateCustomer);
  app.use('/admin/v1', referral.admin);
  app.use('/store/v1', referral.store);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
