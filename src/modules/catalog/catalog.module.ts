import { Router, type RequestHandler } from 'express';
import type { Redis } from 'ioredis';
import { Job } from 'bullmq';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { PrismaStoreContextResolver } from '../../shared/infrastructure/store-context.repository.js';
import { CacheAside } from '../../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../../shared/infrastructure/outbox/outbox-writer.js';
import { getBulkJobsQueue } from '../../shared/infrastructure/queue/queues.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { NotFoundError } from '../../shared/domain/errors.js';
import {
  PrismaProductRepository,
  PrismaAttributeRepository,
  PrismaAttributeSetRepository,
  PrismaProductVariantRepository,
} from './infrastructure/prisma-product.repository.js';
import { PrismaProductAttributeStore } from './infrastructure/product-attribute.store.js';
import { CreateProduct } from './application/create-product.usecase.js';
import { AssignAttributeValue } from './application/assign-attribute-value.usecase.js';
import { GetProductForStoreView } from './application/get-product-for-store-view.usecase.js';
import { CreateAttributeSet } from './application/create-attribute-set.usecase.js';
import { CreateAttributeSetGroup } from './application/create-attribute-set-group.usecase.js';
import { CreateAttribute } from './application/create-attribute.usecase.js';
import { AssignAttributeToGroup } from './application/assign-attribute-to-group.usecase.js';
import { ListProductVariants } from './application/list-product-variants.usecase.js';
import { ListProducts } from './application/list-products.usecase.js';
import { GetProductDetail } from './application/get-product-detail.usecase.js';
import { ListAttributeSets } from './application/list-attribute-sets.usecase.js';
import {
  createProductSchema,
  assignAttributeValueSchema,
  storeViewQuerySchema,
  listProductsQuerySchema,
  createAttributeSetSchema,
  createAttributeSetGroupSchema,
  createAttributeSchema,
  assignAttributeToGroupSchema,
  bulkImportProductsSchema,
} from './interface/http/schemas.js';

export interface CatalogRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the Catalog module — wires ports to Prisma adapters. */
export function createCatalogModule(db: Db, redis: Redis, authorize: (permission: string) => RequestHandler): CatalogRouters {
  const products = new PrismaProductRepository(db);
  const attributes = new PrismaAttributeRepository(db);
  const attributeSets = new PrismaAttributeSetRepository(db);
  const attrStore = new PrismaProductAttributeStore(db);
  const variants = new PrismaProductVariantRepository(db);
  const storeContext = new PrismaStoreContextResolver(db);
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(db);

  const createProduct = new CreateProduct(products, outbox);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache, outbox);
  const getProductForStoreView = new GetProductForStoreView(products, attrStore, storeContext, cache);
  const createAttributeSet = new CreateAttributeSet(attributeSets);
  const createAttributeSetGroup = new CreateAttributeSetGroup(attributeSets);
  const createAttribute = new CreateAttribute(attributes);
  const assignAttributeToGroup = new AssignAttributeToGroup(attributeSets, attributes);
  const listProductVariants = new ListProductVariants(products, variants);
  const listProducts = new ListProducts(products);
  const getProductDetail = new GetProductDetail(products, variants, attrStore);
  const listAttributeSets = new ListAttributeSets(attributeSets);

  // --- Admin API ---
  const admin = Router();
  admin.get(
    '/products',
    asyncHandler(async (req, res) => {
      const query = parse(listProductsQuerySchema, req.query);
      res.json({ data: await listProducts.execute(query) });
    }),
  );
  admin.post(
    '/products',
    asyncHandler(async (req, res) => {
      const body = parse(createProductSchema, req.body);
      const view = await createProduct.execute(body);
      res.status(201).json({ data: view });
    }),
  );
  admin.get(
    '/products/:publicId',
    asyncHandler(async (req, res) => {
      res.json({ data: await getProductDetail.execute(req.params.publicId!) });
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
  admin.get(
    '/products/:publicId/variants',
    asyncHandler(async (req, res) => {
      res.json({ data: await listProductVariants.execute(req.params.publicId!) });
    }),
  );
  admin.get(
    '/attribute-sets',
    asyncHandler(async (req, res) => {
      res.json({ data: await listAttributeSets.execute() });
    }),
  );
  admin.post(
    '/attribute-sets',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAttributeSetSchema, req.body);
      res.status(201).json({ data: await createAttributeSet.execute(body) });
    }),
  );
  admin.post(
    '/attribute-sets/:id/groups',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAttributeSetGroupSchema, req.body);
      res.status(201).json({ data: await createAttributeSetGroup.execute({ ...body, attributeSetId: req.params.id! }) });
    }),
  );
  admin.post(
    '/attributes',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAttributeSchema, req.body);
      res.status(201).json({ data: await createAttribute.execute(body) });
    }),
  );
  admin.post(
    '/attribute-sets/:id/attributes',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(assignAttributeToGroupSchema, req.body);
      await assignAttributeToGroup.execute({ ...body, attributeSetId: req.params.id! });
      res.status(204).send();
    }),
  );
  admin.post(
    '/products/bulk-import',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      // JSON-body rows, not a CSV file upload — no multipart/MinIO presigned-
      // upload plumbing exists yet (that's plan/04 §2.2's Media Manager,
      // unbuilt); this is the documented scope cut for this pass. Processed
      // async by src/workers/bulk-import.worker.ts.
      const body = parse(bulkImportProductsSchema, req.body);
      const job = await getBulkJobsQueue().add('bulk-import-products', { rows: body.rows });
      res.status(202).json({ data: { jobId: job.id } });
    }),
  );
  admin.get(
    '/jobs/:jobId',
    asyncHandler(async (req, res) => {
      // Generic BullMQ job-status reader (bulk-jobs queue) — not bulk-import-
      // specific; reusable by any future job type added to the same queue.
      const job = await Job.fromId(getBulkJobsQueue(), req.params.jobId!);
      if (!job) {
        throw new NotFoundError('job', req.params.jobId);
      }
      const state = await job.getState();
      res.json({
        data: {
          jobId: job.id,
          status: state,
          progress: job.progress,
          result: state === 'completed' ? job.returnvalue : undefined,
          error: state === 'failed' ? job.failedReason : undefined,
        },
      });
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
