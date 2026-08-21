import { Worker } from 'bullmq';
import { BULK_JOBS_QUEUE } from '../shared/infrastructure/queue/queues.js';
import { getQueueConnectionOptions } from '../shared/infrastructure/queue/connection.js';
import { prisma } from '../shared/infrastructure/prisma/client.js';
import { redis } from '../shared/infrastructure/redis/client.js';
import { CacheAside } from '../shared/infrastructure/cache/cache-aside.js';
import { OutboxWriter } from '../shared/infrastructure/outbox/outbox-writer.js';
import { PrismaProductRepository, PrismaAttributeRepository } from '../modules/catalog/infrastructure/prisma-product.repository.js';
import { PrismaProductAttributeStore } from '../modules/catalog/infrastructure/product-attribute.store.js';
import { CreateProduct } from '../modules/catalog/application/create-product.usecase.js';
import { AssignAttributeValue } from '../modules/catalog/application/assign-attribute-value.usecase.js';
import type { BulkImportProductRow, BulkImportResult, BulkImportRowError } from '../modules/catalog/application/dto.js';
import { PrismaWarehouseRepository, PrismaVariantLookup } from '../modules/inventory/infrastructure/prisma-warehouse.repository.js';
import { PrismaStockLedger } from '../modules/inventory/infrastructure/prisma-stock-ledger.js';
import { SetStockQuantity } from '../modules/inventory/application/set-stock-quantity.usecase.js';
import type { BulkStockRow, BulkStockResult, BulkStockRowError } from '../modules/inventory/application/dto.js';
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
  const attrStore = new PrismaProductAttributeStore(prisma);
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(prisma);
  const createProduct = new CreateProduct(products, outbox, attributes, attrStore);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache, outbox);

  const inventoryWarehouses = new PrismaWarehouseRepository(prisma);
  const inventoryVariants = new PrismaVariantLookup(prisma);
  const inventoryLedger = new PrismaStockLedger(prisma);
  const setStockQuantity = new SetStockQuantity(inventoryVariants, inventoryWarehouses, inventoryLedger);

  const worker = new Worker(
    BULK_JOBS_QUEUE,
    async (job): Promise<BulkImportResult | BulkStockResult> => {
      if (job.name === 'bulk-set-stock') {
        return runBulkSetStock(job, setStockQuantity);
      }
      // Default/legacy job name for the pre-existing product-import flow.
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
