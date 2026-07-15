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
import { logger } from '../shared/infrastructure/logger.js';

/**
 * Processes one bulk-import job per request (plan/04 §4). Reuses Catalog's
 * EXISTING CreateProduct/AssignAttributeValue use-cases per-row (reuse, not
 * duplication — these are the correctness-critical product-creation paths),
 * rather than writing bespoke bulk-insert SQL. No CSV parsing — the request
 * body is a JSON array of rows (documented scope cut: no multipart/MinIO
 * upload plumbing exists yet, see catalog.module.ts's bulk-import endpoint
 * comment).
 */
export function startBulkImportWorker(): Worker {
  const products = new PrismaProductRepository(prisma);
  const attributes = new PrismaAttributeRepository(prisma);
  const attrStore = new PrismaProductAttributeStore(prisma);
  const cache = new CacheAside(redis);
  const outbox = new OutboxWriter(prisma);
  const createProduct = new CreateProduct(products, outbox);
  const assignAttributeValue = new AssignAttributeValue(products, attributes, attrStore, cache, outbox);

  const worker = new Worker(
    BULK_JOBS_QUEUE,
    async (job): Promise<BulkImportResult> => {
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
    },
    { connection: getQueueConnectionOptions() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'bulk import job failed'));
  return worker;
}
