import { Worker } from 'bullmq';
import { BULK_JOBS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { redis } from '../shared/infrastructure/redis/client.js';
import { CacheAside } from '../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../shared/infrastructure/outbox/outbox-writer.js';
import {
  PrismaProductRepository,
  PrismaAttributeRepository,
  PrismaAttributeSetRepository,
} from '../modules/catalog/infrastructure/prisma-product.repository.js';
import { PrismaProductAttributeStore } from '../modules/catalog/infrastructure/product-attribute.store.js';
import { PrismaCategoryRepository, PrismaProductCategoryRepository } from '../modules/catalog/infrastructure/prisma-category.repository.js';
import { PrismaBrandRepository } from '../modules/catalog/infrastructure/prisma-brand.repository.js';
import { CreateProduct } from '../modules/catalog/application/create-product.usecase.js';
import { UpdateProduct } from '../modules/catalog/application/update-product.usecase.js';
import { AssignAttributeValue } from '../modules/catalog/application/assign-attribute-value.usecase.js';
import { SetProductCategories } from '../modules/catalog/application/set-product-categories.usecase.js';
import type { AttributeInfo, AttributeOptionInfo } from '../modules/catalog/domain/repositories.js';
import type {
  BulkImportProductRow,
  BulkImportResult,
  BulkImportRowError,
  BulkProductImportRow,
  BulkProductImportResult,
  BulkProductImportRowError,
} from '../modules/catalog/application/dto.js';
import { PrismaWarehouseRepository, PrismaVariantLookup } from '../modules/inventory/infrastructure/prisma-warehouse.repository.js';
import { PrismaStockLedger } from '../modules/inventory/infrastructure/prisma-stock-ledger.js';
import { SetStockQuantity } from '../modules/inventory/application/set-stock-quantity.usecase.js';
import type { BulkStockRow, BulkStockResult, BulkStockRowError } from '../modules/inventory/application/dto.js';
import { PrismaPriceListRepository } from '../modules/pricing/infrastructure/prisma-price-list.repository.js';
// Pricing has its own VariantLookup port/impl (a deliberate small duplicate of
// inventory's, per that file's own doc comment) — aliased here since both are
// literally named PrismaVariantLookup and this worker needs both.
import { PrismaVariantLookup as PrismaPricingVariantLookup } from '../modules/pricing/infrastructure/prisma-customer-group.repository.js';
import { SetProductPrice } from '../modules/pricing/application/set-product-price.usecase.js';
import { logger } from '../shared/infrastructure/logger.js';

/**
 * The single Worker on BULK_JOBS_QUEUE. BullMQ delivers each job to exactly
 * ONE Worker attached to a given queue name — a second `new Worker(BULK_
 * JOBS_QUEUE, ...)` would COMPETE with this one for jobs rather than each
 * getting a copy. So every job type on this queue is dispatched by
 * `job.name` from inside this one processor, not given its own Worker.
 */
export function startBulkImportWorker(): Worker {
  const products = new PrismaProductRepository(prisma);
  const attributes = new PrismaAttributeRepository(prisma);
  const attributeSets = new PrismaAttributeSetRepository(prisma);
  const attrStore = new PrismaProductAttributeStore(prisma);
  const categories = new PrismaCategoryRepository(prisma);
  const productCategories = new PrismaProductCategoryRepository(prisma);
  const brands = new PrismaBrandRepository(prisma);
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(prisma);
  const createProduct = new CreateProduct(products, outbox, attributes, attrStore);
  const updateProduct = new UpdateProduct(products, brands, outbox);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache, outbox);
  const setProductCategories = new SetProductCategories(products, categories, productCategories);

  const inventoryWarehouses = new PrismaWarehouseRepository(prisma);
  const inventoryVariants = new PrismaVariantLookup(prisma);
  const inventoryLedger = new PrismaStockLedger(prisma);
  const setStockQuantity = new SetStockQuantity(inventoryVariants, inventoryWarehouses, inventoryLedger);

  const priceLists = new PrismaPriceListRepository(prisma);
  const pricingVariants = new PrismaPricingVariantLookup(prisma);
  const setProductPrice = new SetProductPrice(priceLists, pricingVariants, outbox);

  const upsertDeps: BulkUpsertDeps = {
    products,
    attributes,
    attributeSets,
    createProduct,
    updateProduct,
    assignAttributeValue,
    setProductCategories,
    setProductPrice,
    setStockQuantity,
    categories,
    inventoryVariants,
  };

  const worker = new Worker(
    BULK_JOBS_QUEUE,
    async (job): Promise<BulkImportResult | BulkStockResult | BulkProductImportResult> => {
      if (job.name === 'bulk-set-stock') {
        return runBulkSetStock(job, setStockQuantity);
      }
      if (job.name === 'bulk-upsert-products') {
        return runBulkUpsertProducts(job, upsertDeps);
      }
      // Default/legacy job name for the pre-existing create-only product-import flow.
      return runBulkImportProducts(job, createProduct, assignAttributeValue);
    },
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id, jobName: job?.name }, 'bulk job failed'));
  return worker;
}

/**
 * Reuses Catalog's EXISTING CreateProduct/AssignAttributeValue use-cases
 * per-row (reuse, not duplication — these are the correctness-critical
 * product-creation paths), rather than writing bespoke bulk-insert SQL. No
 * CSV parsing — the request body is a JSON array of rows (documented scope
 * cut: no multipart/MinIO upload plumbing exists yet, see catalog.module.
 * ts's bulk-import endpoint comment).
 */
async function runBulkImportProducts(
  job: { data: unknown; updateProgress: (n: number) => Promise<void> },
  createProduct: CreateProduct,
  assignAttributeValue: AssignAttributeValue,
): Promise<BulkImportResult> {
  const { rows } = job.data as { rows: BulkImportProductRow[] };
  const errors: BulkImportRowError[] = [];
  let succeeded = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const created = await createProduct.execute({
        type: row.type,
        sku: row.sku,
        attributeSetId: row.attributeSetId,
        status: row.status,
        visibility: row.visibility,
        nameDefault: row.nameDefault,
      });
      for (const [attributeCode, value] of Object.entries(row.attributes ?? {})) {
        await assignAttributeValue.execute({
          productPublicId: created.publicId,
          attributeCode,
          scope: 'GLOBAL',
          value,
        });
      }
      succeeded++;
    } catch (err) {
      errors.push({ row: i, sku: row.sku, message: err instanceof Error ? err.message : String(err) });
    }
    await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
  }

  return { total: rows.length, succeeded, failed: errors.length, errors };
}

/**
 * Magento-style "set qty by SKU" CSV import. One row = one absolute
 * on-hand target for one SKU at the job's warehouse; SetStockQuantity
 * computes the equivalent delta and applies it through the same guarded
 * StockLedger.adjust() every other stock mutation uses. Mirrors
 * runBulkImportProducts's per-row try/catch/progress/error-collection
 * shape exactly, so a partial failure (one bad SKU) doesn't abort the rest
 * of the CSV.
 */
async function runBulkSetStock(
  job: { data: unknown; updateProgress: (n: number) => Promise<void> },
  setStockQuantity: SetStockQuantity,
): Promise<BulkStockResult> {
  const { warehouseCode, rows } = job.data as { warehouseCode: string; rows: BulkStockRow[] };
  const errors: BulkStockRowError[] = [];
  let succeeded = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      await setStockQuantity.execute({
        sku: row.sku,
        warehouseCode,
        quantity: row.quantity,
        note: 'Bulk stock import',
      });
      succeeded++;
    } catch (err) {
      errors.push({ row: i, sku: row.sku, message: err instanceof Error ? err.message : String(err) });
    }
    await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
  }

  return { total: rows.length, succeeded, failed: errors.length, errors };
}

interface BulkUpsertDeps {
  products: PrismaProductRepository;
  attributes: PrismaAttributeRepository;
  attributeSets: PrismaAttributeSetRepository;
  createProduct: CreateProduct;
  updateProduct: UpdateProduct;
  assignAttributeValue: AssignAttributeValue;
  setProductCategories: SetProductCategories;
  setProductPrice: SetProductPrice;
  setStockQuantity: SetStockQuantity;
  categories: PrismaCategoryRepository;
  /** Inventory's own cross-module SKU lookup, reused here (rather than a second
   *  variant-by-sku query) to resolve the variantPublicId SetProductPrice needs. */
  inventoryVariants: PrismaVariantLookup;
}

/**
 * Converts one CSV cell's raw text into the typed value AssignAttributeValue
 * expects, mirroring exactly what the admin's own AttributeFieldsSection
 * form submits for each dataType (see attribute-fields-section.tsx) — SELECT
 * and MULTISELECT in particular take the option's id/value internally, never
 * the human-typed label, so those two resolve the label/value the admin
 * typed against the attribute's real options first. REF_-family/JSON/IMAGE/
 * FILE types aren't supported by CSV import (no sensible flat-text form)
 * and throw a clear per-row error instead of silently mis-storing something.
 */
async function parseAttributeCell(
  attribute: AttributeInfo,
  raw: string,
  loadOptions: (code: string) => Promise<AttributeOptionInfo[]>,
): Promise<unknown> {
  const text = raw.trim();
  switch (attribute.dataType) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'URL':
    case 'EMAIL':
    case 'PHONE':
    case 'COLOR':
    case 'RICHTEXT':
      return text;
    case 'NUMBER': {
      const n = Number(text);
      if (!Number.isFinite(n)) throw new Error(`invalid number "${raw}" for attribute "${attribute.code}"`);
      return n;
    }
    case 'DECIMAL':
      if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`invalid decimal "${raw}" for attribute "${attribute.code}"`);
      return text;
    case 'BOOLEAN': {
      const v = text.toLowerCase();
      if (['true', '1', 'yes'].includes(v)) return true;
      if (['false', '0', 'no'].includes(v)) return false;
      throw new Error(`invalid boolean "${raw}" for attribute "${attribute.code}" (use true/false)`);
    }
    case 'DATE':
    case 'DATETIME':
      if (Number.isNaN(new Date(text).getTime())) throw new Error(`invalid date "${raw}" for attribute "${attribute.code}"`);
      return text;
    case 'SELECT': {
      const options = await loadOptions(attribute.code);
      const match = options.find((o) => o.label.toLowerCase() === text.toLowerCase() || o.value.toLowerCase() === text.toLowerCase());
      if (!match) throw new Error(`unknown option "${raw}" for attribute "${attribute.code}"`);
      return match.id.toString();
    }
    case 'MULTISELECT': {
      const options = await loadOptions(attribute.code);
      const values: string[] = [];
      for (const piece of text.split('|').map((s) => s.trim()).filter(Boolean)) {
        const match = options.find((o) => o.label.toLowerCase() === piece.toLowerCase() || o.value.toLowerCase() === piece.toLowerCase());
        if (!match) throw new Error(`unknown option "${piece}" for attribute "${attribute.code}"`);
        values.push(match.value);
      }
      return values;
    }
    default:
      throw new Error(`attribute "${attribute.code}" (${attribute.dataType}) isn't supported by CSV import`);
  }
}

/**
 * Magento-style "Add/Update" product CSV import (plan continuation of the
 * bulk-set-stock feature) — creates a product when `sku` is new, patches it
 * when it already exists, then applies attributes/categories/price/qty as
 * optional overlays. All per-row side effects reuse the SAME use-cases the
 * admin product-edit form itself calls (CreateProduct, UpdateProduct,
 * AssignAttributeValue, SetProductCategories, SetProductPrice,
 * SetStockQuantity) — there is no separate bulk-only write path, so a CSV
 * import can never do something the admin UI itself couldn't.
 *
 * Attribute/attribute-option lookups are cached per job (a Map, not a query
 * per row) — the same handful of attribute codes/options repeat across
 * potentially thousands of rows.
 */
async function runBulkUpsertProducts(
  job: { data: unknown; updateProgress: (n: number) => Promise<void> },
  deps: BulkUpsertDeps,
): Promise<BulkProductImportResult> {
  const { priceListCode, warehouseCode, rows } = job.data as {
    priceListCode?: string;
    warehouseCode?: string;
    rows: BulkProductImportRow[];
  };
  const errors: BulkProductImportRowError[] = [];
  let created = 0;
  let updated = 0;

  const attributeCache = new Map<string, AttributeInfo | null>();
  const optionsCache = new Map<string, AttributeOptionInfo[]>();
  async function getAttribute(code: string): Promise<AttributeInfo | null> {
    if (!attributeCache.has(code)) attributeCache.set(code, await deps.attributes.findByCode(code));
    return attributeCache.get(code)!;
  }
  async function getOptions(code: string): Promise<AttributeOptionInfo[]> {
    if (!optionsCache.has(code)) optionsCache.set(code, await deps.attributes.listOptions(code));
    return optionsCache.get(code)!;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const existing = await deps.products.findBySku(row.sku);
      let productPublicId: string;
      // Counters are only bumped once the WHOLE row succeeds (see the end of
      // this try block) — a row that updates the product but then fails on,
      // say, an unknown category slug must land in `errors`, not in both
      // `updated` and `errors`. Same "one terminal counter per row" shape
      // runBulkImportProducts already uses (its succeeded++ is likewise the
      // last statement in its try block).
      let wasCreate: boolean;

      if (existing) {
        let attributeSetId: string | undefined;
        if (row.attributeSetCode) {
          const set = await deps.attributeSets.findSetByCode(row.attributeSetCode);
          if (!set) throw new Error(`unknown attribute set code "${row.attributeSetCode}"`);
          attributeSetId = set.id.toString();
        }
        await deps.updateProduct.execute({
          publicId: existing.publicId,
          nameDefault: row.nameDefault,
          status: row.status,
          visibility: row.visibility,
          weight: row.weight,
          attributeSetId,
        });
        productPublicId = existing.publicId;
        wasCreate = false;
      } else {
        if (!row.type) throw new Error('"type" is required to create a new product (this SKU does not exist yet)');
        if (!row.attributeSetCode) throw new Error('"attributeSetCode" is required to create a new product (this SKU does not exist yet)');
        const set = await deps.attributeSets.findSetByCode(row.attributeSetCode);
        if (!set) throw new Error(`unknown attribute set code "${row.attributeSetCode}"`);
        const createdProduct = await deps.createProduct.execute({
          type: row.type,
          sku: row.sku,
          attributeSetId: set.id.toString(),
          status: row.status,
          visibility: row.visibility,
          nameDefault: row.nameDefault,
          weight: row.weight,
        });
        productPublicId = createdProduct.publicId;
        wasCreate = true;
      }

      for (const [code, rawValue] of Object.entries(row.attributes ?? {})) {
        const attribute = await getAttribute(code);
        if (!attribute) throw new Error(`unknown attribute code "${code}"`);
        const value = await parseAttributeCell(attribute, rawValue, getOptions);
        await deps.assignAttributeValue.execute({ productPublicId, attributeCode: code, scope: 'GLOBAL', value });
      }

      if (row.categorySlugs !== undefined) {
        const categoryIds: string[] = [];
        for (const slug of row.categorySlugs) {
          const category = await deps.categories.findBySlug(slug);
          if (!category) throw new Error(`unknown category slug "${slug}"`);
          categoryIds.push(category.publicId);
        }
        await deps.setProductCategories.execute({ productPublicId, categoryIds });
      }

      if (row.price != null) {
        if (!priceListCode) throw new Error('a price list must be selected on this import to set prices');
        const variant = await deps.inventoryVariants.bySku(row.sku);
        if (!variant) throw new Error('could not resolve this SKU\'s variant to set its price');
        await deps.setProductPrice.execute({ priceListCode, variantPublicId: variant.publicId, price: row.price, mrp: row.mrp ?? null });
      }

      if (row.qty != null) {
        if (!warehouseCode) throw new Error('a warehouse must be selected on this import to set stock quantities');
        await deps.setStockQuantity.execute({ sku: row.sku, warehouseCode, quantity: row.qty, note: 'Bulk product import' });
      }

      if (wasCreate) created++;
      else updated++;
    } catch (err) {
      errors.push({ row: i, sku: row.sku, message: err instanceof Error ? err.message : String(err) });
    }
    await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
  }

  return { total: rows.length, created, updated, failed: errors.length, errors };
}
