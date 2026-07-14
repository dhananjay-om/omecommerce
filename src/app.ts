import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './shared/infrastructure/logger.js';
import { installBigIntJson } from './shared/interface/http/serialization.js';
import { requestContext, notFound, errorHandler } from './shared/interface/http/middleware.js';
import { healthRouter } from './shared/interface/http/health.route.js';
import { prisma } from './shared/infrastructure/prisma/client.js';
import { createCatalogModule } from './modules/catalog/catalog.module.js';
import { createInventoryModule } from './modules/inventory/inventory.module.js';

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

  // Modules
  const catalog = createCatalogModule(prisma);
  app.use('/admin/v1', catalog.admin);
  app.use('/store/v1', catalog.store);

  const inventory = createInventoryModule(prisma);
  app.use('/admin/v1', inventory.admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
