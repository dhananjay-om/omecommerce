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
  PrismaVariantStockLookup,
} from './infrastructure/prisma-product.repository.js';
import { PrismaCategoryRepository, PrismaProductCategoryRepository } from './infrastructure/prisma-category.repository.js';
import { PrismaBrandRepository } from './infrastructure/prisma-brand.repository.js';
import { PrismaMediaAssetRepository, PrismaProductMediaRepository } from './infrastructure/prisma-media.repository.js';
import { S3MediaStorage } from './infrastructure/s3-media-storage.js';
import { PrismaProductAttributeStore } from './infrastructure/product-attribute.store.js';
import { PrismaPriceResolver } from '../pricing/infrastructure/prisma-price-resolver.js';
import { CreateProduct } from './application/create-product.usecase.js';
import { UpdateProduct } from './application/update-product.usecase.js';
import { DeleteProduct } from './application/delete-product.usecase.js';
import { AssignAttributeValue } from './application/assign-attribute-value.usecase.js';
import { AssignAttributeValues } from './application/assign-attribute-values.usecase.js';
import { GetProductForStoreView } from './application/get-product-for-store-view.usecase.js';
import { GetStoreProductDetail } from './application/get-store-product-detail.usecase.js';
import { GetStoreProductDetailBySlug } from './application/get-store-product-detail-by-slug.usecase.js';
import { CreateAttributeSet } from './application/create-attribute-set.usecase.js';
import { CreateAttributeSetGroup } from './application/create-attribute-set-group.usecase.js';
import { CreateAttribute } from './application/create-attribute.usecase.js';
import { UpdateAttribute } from './application/update-attribute.usecase.js';
import { DeleteAttribute } from './application/delete-attribute.usecase.js';
import { DeleteAttributeSet } from './application/delete-attribute-set.usecase.js';
import { RemoveAttributeFromSet } from './application/remove-attribute-from-set.usecase.js';
import { AssignAttributeToGroup } from './application/assign-attribute-to-group.usecase.js';
import { ListProductVariants } from './application/list-product-variants.usecase.js';
import { GenerateProductVariants } from './application/generate-product-variants.usecase.js';
import { UpdateProductVariant } from './application/update-product-variant.usecase.js';
import { DeleteProductVariant } from './application/delete-product-variant.usecase.js';
import { ListProducts } from './application/list-products.usecase.js';
import { GetProductDetail } from './application/get-product-detail.usecase.js';
import { ListAttributeSets } from './application/list-attribute-sets.usecase.js';
import { ListAttributes, ListAttributeOptions } from './application/list-attributes.usecase.js';
import { GetAttributeSetDetail } from './application/get-attribute-set-detail.usecase.js';
import { CreateCategory } from './application/create-category.usecase.js';
import { ListCategories } from './application/list-categories.usecase.js';
import { UpdateCategory } from './application/update-category.usecase.js';
import { ReparentCategory } from './application/reparent-category.usecase.js';
import { DeleteCategory } from './application/delete-category.usecase.js';
import { SetProductCategories } from './application/set-product-categories.usecase.js';
import { GetCategoryBySlug } from './application/get-category-by-slug.usecase.js';
import { RequestCategoryImageUpload } from './application/request-category-image-upload.usecase.js';
import { CreateBrand } from './application/create-brand.usecase.js';
import { ListBrands } from './application/list-brands.usecase.js';
import { UpdateBrand } from './application/update-brand.usecase.js';
import { DeleteBrand } from './application/delete-brand.usecase.js';
import { GetBrandBySlug } from './application/get-brand-by-slug.usecase.js';
import { RequestMediaUpload } from './application/request-media-upload.usecase.js';
import { CreateMediaAsset } from './application/create-media-asset.usecase.js';
import { AttachProductMedia } from './application/attach-product-media.usecase.js';
import { DetachProductMedia } from './application/detach-product-media.usecase.js';
import { SetProductThumbnail } from './application/set-product-thumbnail.usecase.js';
import {
  createProductSchema,
  updateProductSchema,
  generateVariantsSchema,
  updateVariantSchema,
  assignAttributeValueSchema,
  assignAttributeValuesSchema,
  storeViewQuerySchema,
  listProductsQuerySchema,
  createAttributeSetSchema,
  createAttributeSetGroupSchema,
  createAttributeSchema,
  updateAttributeSchema,
  assignAttributeToGroupSchema,
  bulkImportProductsSchema,
  bulkUpsertProductsSchema,
  createCategorySchema,
  updateCategorySchema,
  reparentCategorySchema,
  requestCategoryImageUploadSchema,
  setProductCategoriesSchema,
  createBrandSchema,
  updateBrandSchema,
  requestMediaUploadSchema,
  createMediaAssetSchema,
  attachProductMediaSchema,
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
  const categories = new PrismaCategoryRepository(db);
  const productCategories = new PrismaProductCategoryRepository(db);
  const brands = new PrismaBrandRepository(db);
  const mediaAssets = new PrismaMediaAssetRepository(db);
  const productMedia = new PrismaProductMediaRepository(db);
  const mediaStorage = new S3MediaStorage();
  const storeContext = new PrismaStoreContextResolver(db);
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(db);
  const variantStock = new PrismaVariantStockLookup(db);
  const priceResolver = new PrismaPriceResolver(db);

  const createProduct = new CreateProduct(products, outbox, attributes, attrStore);
  const updateProduct = new UpdateProduct(products, brands, outbox);
  const deleteProduct = new DeleteProduct(products, outbox);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache, outbox);
  const assignAttributeValues = new AssignAttributeValues(products, attributes, attrStore, cache, outbox);
  const getProductForStoreView = new GetProductForStoreView(products, attrStore, storeContext, cache);
  const getStoreProductDetail = new GetStoreProductDetail(
    products,
    variants,
    productCategories,
    productMedia,
    mediaStorage,
    priceResolver,
    variantStock,
    storeContext,
    getProductForStoreView,
  );
  const getStoreProductDetailBySlug = new GetStoreProductDetailBySlug(products, getStoreProductDetail);
  const createAttributeSet = new CreateAttributeSet(attributeSets);
  const createAttributeSetGroup = new CreateAttributeSetGroup(attributeSets);
  const createAttribute = new CreateAttribute(attributes);
  const updateAttribute = new UpdateAttribute(attributes);
  const deleteAttribute = new DeleteAttribute(attributes);
  const deleteAttributeSet = new DeleteAttributeSet(attributeSets);
  const removeAttributeFromSet = new RemoveAttributeFromSet(attributeSets, attributes);
  const assignAttributeToGroup = new AssignAttributeToGroup(attributeSets, attributes);
  const listProductVariants = new ListProductVariants(products, variants);
  const generateProductVariants = new GenerateProductVariants(products, variants, attributeSets, attributes);
  const updateProductVariant = new UpdateProductVariant(variants);
  const deleteProductVariant = new DeleteProductVariant(variants);
  const listProducts = new ListProducts(products, productMedia, mediaStorage);
  const getProductDetail = new GetProductDetail(products, variants, attrStore, productCategories, productMedia, mediaStorage);
  const listAttributeSets = new ListAttributeSets(attributeSets);
  const getAttributeSetDetail = new GetAttributeSetDetail(attributeSets);
  const listAttributes = new ListAttributes(attributes);
  const listAttributeOptions = new ListAttributeOptions(attributes);
  const createCategory = new CreateCategory(categories);
  const listCategories = new ListCategories(categories);
  const updateCategory = new UpdateCategory(categories);
  const reparentCategory = new ReparentCategory(categories);
  const deleteCategory = new DeleteCategory(categories);
  const getCategoryBySlug = new GetCategoryBySlug(categories);
  const setProductCategories = new SetProductCategories(products, categories, productCategories);
  const requestCategoryImageUpload = new RequestCategoryImageUpload(categories);
  const createBrand = new CreateBrand(brands);
  const listBrands = new ListBrands(brands);
  const updateBrand = new UpdateBrand(brands);
  const deleteBrand = new DeleteBrand(brands);
  const getBrandBySlug = new GetBrandBySlug(brands);
  const requestMediaUpload = new RequestMediaUpload(mediaStorage);
  const createMediaAsset = new CreateMediaAsset(mediaAssets);
  const attachProductMedia = new AttachProductMedia(products, mediaAssets, productMedia, mediaStorage);
  const detachProductMedia = new DetachProductMedia(products, productMedia);
  const setProductThumbnail = new SetProductThumbnail(products, productMedia, mediaStorage);

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
  admin.patch(
    '/products/:publicId',
    asyncHandler(async (req, res) => {
      const body = parse(updateProductSchema, req.body);
      const view = await updateProduct.execute({ ...body, publicId: req.params.publicId! });
      res.json({ data: view });
    }),
  );
  admin.delete(
    '/products/:publicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteProduct.execute(req.params.publicId!);
      res.status(204).send();
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
  admin.put(
    '/products/:publicId/attributes/bulk',
    asyncHandler(async (req, res) => {
      const body = parse(assignAttributeValuesSchema, req.body);
      await assignAttributeValues.execute({ productPublicId: req.params.publicId!, values: body.values });
      res.status(204).send();
    }),
  );
  admin.get(
    '/products/:publicId/variants',
    asyncHandler(async (req, res) => {
      res.json({ data: await listProductVariants.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/products/:publicId/variants/generate',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(generateVariantsSchema, req.body);
      const result = await generateProductVariants.execute({ productPublicId: req.params.publicId!, axes: body.axes });
      res.status(201).json({ data: result });
    }),
  );
  admin.patch(
    '/products/:publicId/variants/:variantPublicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateVariantSchema, req.body);
      const view = await updateProductVariant.execute({
        productPublicId: req.params.publicId!,
        variantPublicId: req.params.variantPublicId!,
        ...body,
      });
      res.json({ data: view });
    }),
  );
  admin.delete(
    '/products/:publicId/variants/:variantPublicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteProductVariant.execute(req.params.variantPublicId!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/attribute-sets',
    asyncHandler(async (req, res) => {
      res.json({ data: await listAttributeSets.execute() });
    }),
  );
  admin.get(
    '/attribute-sets/:id',
    asyncHandler(async (req, res) => {
      res.json({ data: await getAttributeSetDetail.execute(req.params.id!) });
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
  admin.delete(
    '/attribute-sets/:id',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteAttributeSet.execute(req.params.id!);
      res.status(204).send();
    }),
  );
  admin.delete(
    '/attribute-sets/:id/attributes/:attributeCode',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await removeAttributeFromSet.execute(req.params.id!, req.params.attributeCode!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/attributes',
    asyncHandler(async (req, res) => {
      res.json({ data: await listAttributes.execute() });
    }),
  );
  admin.get(
    '/attributes/:code/options',
    asyncHandler(async (req, res) => {
      res.json({ data: await listAttributeOptions.execute(req.params.code!) });
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
  admin.patch(
    '/attributes/:code',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateAttributeSchema, req.body);
      res.json({ data: await updateAttribute.execute(req.params.code!, body) });
    }),
  );
  admin.delete(
    '/attributes/:code',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteAttribute.execute(req.params.code!);
      res.status(204).send();
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
  admin.get(
    '/categories',
    asyncHandler(async (req, res) => {
      res.json({ data: await listCategories.execute() });
    }),
  );
  admin.post(
    '/categories',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createCategorySchema, req.body);
      res.status(201).json({ data: await createCategory.execute(body) });
    }),
  );
  admin.patch(
    '/categories/:publicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCategorySchema, req.body);
      res.json({ data: await updateCategory.execute({ ...body, publicId: req.params.publicId! }) });
    }),
  );
  admin.put(
    '/categories/:publicId/parent',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(reparentCategorySchema, req.body);
      res.json({ data: await reparentCategory.execute({ publicId: req.params.publicId!, newParentId: body.newParentId }) });
    }),
  );
  admin.delete(
    '/categories/:publicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteCategory.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/categories/:publicId/image-upload-url',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(requestCategoryImageUploadSchema, req.body);
      const result = await requestCategoryImageUpload.execute({ publicId: req.params.publicId!, ...body });
      res.status(201).json({ data: result });
    }),
  );
  admin.put(
    '/products/:publicId/categories',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(setProductCategoriesSchema, req.body);
      await setProductCategories.execute({ productPublicId: req.params.publicId!, categoryIds: body.categoryIds });
      res.status(204).send();
    }),
  );
  admin.get(
    '/brands',
    asyncHandler(async (req, res) => {
      res.json({ data: await listBrands.execute() });
    }),
  );
  admin.post(
    '/brands',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createBrandSchema, req.body);
      res.status(201).json({ data: await createBrand.execute(body) });
    }),
  );
  admin.patch(
    '/brands/:publicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateBrandSchema, req.body);
      res.json({ data: await updateBrand.execute({ ...body, publicId: req.params.publicId! }) });
    }),
  );
  admin.delete(
    '/brands/:publicId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await deleteBrand.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/media/uploads',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(requestMediaUploadSchema, req.body);
      res.status(201).json({ data: await requestMediaUpload.execute(body) });
    }),
  );
  admin.post(
    '/media',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createMediaAssetSchema, req.body);
      res.status(201).json({ data: await createMediaAsset.execute(body) });
    }),
  );
  admin.post(
    '/products/:publicId/media',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(attachProductMediaSchema, req.body);
      const view = await attachProductMedia.execute({ productPublicId: req.params.publicId!, ...body });
      res.status(201).json({ data: view });
    }),
  );
  admin.delete(
    '/products/:publicId/media/:productMediaId',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      await detachProductMedia.execute({ productPublicId: req.params.publicId!, productMediaId: req.params.productMediaId! });
      res.status(204).send();
    }),
  );
  admin.post(
    '/products/:publicId/media/:productMediaId/set-thumbnail',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      const view = await setProductThumbnail.execute({ productPublicId: req.params.publicId!, productMediaId: req.params.productMediaId! });
      res.json({ data: view });
    }),
  );
  admin.post(
    '/products/bulk-import',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      // JSON-body rows, not a CSV file upload — bulk-import is still a
      // separate JSON-array flow from the direct-to-storage image upload
      // added alongside it (POST /media/uploads); the two aren't related.
      // Processed async by src/workers/bulk-import.worker.ts.
      const body = parse(bulkImportProductsSchema, req.body);
      const job = await getBulkJobsQueue().add('bulk-import-products', { rows: body.rows });
      res.status(202).json({ data: { jobId: job.id } });
    }),
  );
  admin.post(
    '/products/bulk-upsert',
    authorize('catalog:manage'),
    asyncHandler(async (req, res) => {
      // Magento-style "Add/Update" CSV import: creates a product for an
      // unrecognized SKU, patches an existing one otherwise — one job type
      // (`bulk-upsert-products`) on the SAME shared bulk-jobs queue as
      // bulk-import-products above, dispatched from the SAME worker (BullMQ
      // delivers each job to exactly one Worker per queue name). Polled via
      // the same generic GET /admin/v1/jobs/:jobId below.
      const body = parse(bulkUpsertProductsSchema, req.body);
      const job = await getBulkJobsQueue().add('bulk-upsert-products', {
        priceListCode: body.priceListCode,
        warehouseCode: body.warehouseCode,
        rows: body.rows,
      });
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
      const view = await getStoreProductDetail.execute({
        productPublicId: req.params.publicId!,
        storeViewId: query.storeViewId,
      });
      res.json({ data: view });
    }),
  );
  // The PDP's real entry point (/{slug}.html) — kept as a distinct route
  // rather than overloading :publicId above (a publicId is always a UUID; a
  // slug never is, so making one param accept both is an avoidable ambiguity,
  // not a real simplification) — same "separate slug route" precedent
  // /collections/:slug and /brands/:slug already use.
  store.get(
    '/products/by-slug/:slug',
    asyncHandler(async (req, res) => {
      const query = parse(storeViewQuerySchema, req.query);
      const view = await getStoreProductDetailBySlug.execute(req.params.slug!, query.storeViewId);
      res.json({ data: view });
    }),
  );
  store.get(
    '/categories',
    asyncHandler(async (req, res) => {
      res.json({ data: await listCategories.execute() });
    }),
  );
  store.get(
    '/categories/:slug',
    asyncHandler(async (req, res) => {
      res.json({ data: await getCategoryBySlug.execute(req.params.slug!) });
    }),
  );
  store.get(
    '/brands',
    asyncHandler(async (req, res) => {
      res.json({ data: await listBrands.execute() });
    }),
  );
  store.get(
    '/brands/:slug',
    asyncHandler(async (req, res) => {
      res.json({ data: await getBrandBySlug.execute(req.params.slug!) });
    }),
  );

  return { admin, store };
}
