import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { PrismaStoreContextResolver } from '../../shared/infrastructure/store-context.repository.js';
import { CacheAside } from '../../shared/infrastructure/cache/cache-aside.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import {
  PrismaProductRepository,
  PrismaAttributeRepository,
} from './infrastructure/prisma-product.repository.js';
import { PrismaProductAttributeStore } from './infrastructure/product-attribute.store.js';
import { CreateProduct } from './application/create-product.usecase.js';
import { AssignAttributeValue } from './application/assign-attribute-value.usecase.js';
import { GetProductForStoreView } from './application/get-product-for-store-view.usecase.js';
import {
  createProductSchema,
  assignAttributeValueSchema,
  storeViewQuerySchema,
} from './interface/http/schemas.js';

export interface CatalogRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Catalog module — wires ports to Prisma adapters. */
export function createCatalogModule(db: Db, redis: Redis): CatalogRouters {
  const products = new PrismaProductRepository(db);
  const attributes = new PrismaAttributeRepository(db);
  const attrStore = new PrismaProductAttributeStore(db);
  const storeContext = new PrismaStoreContextResolver(db);
  const cache = new CacheAside(redis);

  const createProduct = new CreateProduct(products);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache);
  const getProductForStoreView = new GetProductForStoreView(products, attrStore, storeContext, cache);

  // --- Admin API ---
  const admin = Router();
  admin.post(
    '/products',
    asyncHandler(async (req, res) => {
      const body = parse(createProductSchema, req.body);
      const view = await createProduct.execute(body);
      res.status(201).json({ data: view });
    }),
  );
  admin.put(
    '/products/:publicId/attributes',
    asyncHandler(async (req, res) => {
      const body = parse(assignAttributeValueSchema, req.body);
      await assignAttributeValue.execute({ ...body, productPublicId: req.params.publicId! });
      res.status(204).send();
    }),
  );

  // --- Storefront API ---
  const store = Router();
  store.get(
    '/products/:publicId',
    asyncHandler(async (req, res) => {
      const query = parse(storeViewQuerySchema, req.query);
      const view = await getProductForStoreView.execute({
        productPublicId: req.params.publicId!,
        storeViewId: query.storeViewId,
      });
      res.json({ data: view });
    }),
  );

  return { admin, store };
}
