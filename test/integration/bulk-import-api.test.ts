import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Worker } from 'bullmq';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';
import { startBulkImportWorker } from '../../src/workers/bulk-import.worker.js';

/**
 * Bulk product import over HTTP (live DB) — plan/04 §4. Unlike every other
 * integration test, this one's feature is INHERENTLY async (202 + job id +
 * poll) with no synchronous variant, so — as an explicit, scoped exception to
 * "workers only run via main.ts, never in tests" — this file starts the real
 * bulk-import worker itself and tears it down in afterAll. No other test file
 * needs to do this. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('bulk product import API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let worker: Worker;

  async function pollJob(jobId: string, timeoutMs = 5000): Promise<{ status: string; progress: unknown; result?: unknown; error?: unknown }> {
    const start = Date.now();
    for (;;) {
      const res = await admin.get(`/admin/v1/jobs/${jobId}`);
      if (res.body.data.status === 'completed' || res.body.data.status === 'failed') {
        return res.body.data;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`job ${jobId} did not complete within ${timeoutMs}ms (last status: ${res.body.data.status})`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE product RESTART IDENTITY CASCADE');
    const set = await prisma.attributeSet.upsert({
      where: { code: 'bulk-import-test-set' },
      update: {},
      create: { code: 'bulk-import-test-set', name: 'Bulk Import Test Set' },
    });
    attributeSetId = set.id.toString();
    await prisma.attribute.upsert({
      where: { code: 'bulk-color' },
      update: {},
      create: { code: 'bulk-color', label: 'Color', dataType: 'TEXT', inputType: 'TEXT' },
    });
    admin = adminRequest(app, await getAdminToken(app));
    worker = startBulkImportWorker();
  });

  afterAll(async () => {
    await worker.close();
    await prisma.$disconnect();
  });

  it('rejects an empty rows array with 422', async () => {
    const res = await admin.post('/admin/v1/products/bulk-import').send({ rows: [] });
    expect(res.status).toBe(422);
  });

  it('404s polling a non-existent job id', async () => {
    const res = await admin.get('/admin/v1/jobs/does-not-exist-12345');
    expect(res.status).toBe(404);
  });

  it('processes a mixed batch: succeeds valid rows, reports errors for invalid ones, row-indexed', async () => {
    const enqueue = await admin.post('/admin/v1/products/bulk-import').send({
      rows: [
        { sku: 'BULK-OK-1', type: 'SIMPLE', attributeSetId, nameDefault: 'Bulk One', attributes: { 'bulk-color': 'red' } },
        { sku: 'BULK-OK-1', type: 'SIMPLE', attributeSetId, nameDefault: 'Duplicate SKU' }, // row 1: conflict (same SKU as row 0)
        { sku: 'BULK-BAD-ATTRSET', type: 'SIMPLE', attributeSetId: '999999', nameDefault: 'Bad attribute set' }, // row 2: FK violation
        { sku: 'BULK-OK-2', type: 'SIMPLE', attributeSetId, nameDefault: 'Bulk Two' },
      ],
    });
    expect(enqueue.status).toBe(202);
    const jobId = enqueue.body.data.jobId as string;
    expect(jobId).toEqual(expect.any(String));

    const finished = await pollJob(jobId);
    expect(finished.status).toBe('completed');
    expect(finished.result).toMatchObject({ total: 4, succeeded: 2, failed: 2 });
    const errors = (finished.result as { errors: Array<{ row: number; sku: string }> }).errors;
    expect(errors.map((e) => e.row).sort()).toEqual([1, 2]);
    expect(errors.find((e) => e.row === 1)?.sku).toBe('BULK-OK-1');
    expect(errors.find((e) => e.row === 2)?.sku).toBe('BULK-BAD-ATTRSET');

    const created = await prisma.product.findMany({ where: { sku: { in: ['BULK-OK-1', 'BULK-OK-2'] } } });
    expect(created).toHaveLength(2);
    const colorValue = await prisma.productAttributeValue.findFirst({
      where: { product: { sku: 'BULK-OK-1' }, attribute: { code: 'bulk-color' } },
    });
    expect(colorValue?.valueText).toBe('red');
  });

  describe('bulk stock import (bulk-set-stock job on the same queue)', () => {
    beforeAll(async () => {
      await prisma.warehouse.upsert({
        where: { code: 'WH-BULK-STOCK' },
        update: {},
        create: { code: 'WH-BULK-STOCK', name: 'Bulk Stock Test Warehouse' },
      });
      await admin.post('/admin/v1/products').send({
        type: 'SIMPLE',
        sku: 'BULK-STOCK-SKU-1',
        attributeSetId,
        status: 'ACTIVE',
      });
    });

    it('rejects an empty rows array with 422', async () => {
      const res = await admin.post('/admin/v1/inventory/bulk-set-stock').send({ warehouseCode: 'WH-BULK-STOCK', rows: [] });
      expect(res.status).toBe(422);
    });

    it('sets on-hand to the given absolute quantity, reports a per-row error for an unknown SKU, and shares the generic job-status endpoint', async () => {
      const enqueue = await admin.post('/admin/v1/inventory/bulk-set-stock').send({
        warehouseCode: 'WH-BULK-STOCK',
        rows: [
          { sku: 'BULK-STOCK-SKU-1', quantity: 42 },
          { sku: 'BULK-STOCK-SKU-DOES-NOT-EXIST', quantity: 5 },
        ],
      });
      expect(enqueue.status).toBe(202);
      const jobId = enqueue.body.data.jobId as string;

      const finished = await pollJob(jobId);
      expect(finished.status).toBe('completed');
      expect(finished.result).toMatchObject({ total: 2, succeeded: 1, failed: 1 });
      const errors = (finished.result as { errors: Array<{ row: number; sku: string }> }).errors;
      expect(errors).toEqual([{ row: 1, sku: 'BULK-STOCK-SKU-DOES-NOT-EXIST', message: expect.any(String) }]);

      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'BULK-STOCK-SKU-1' } });
      const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId: variant.publicId, warehouseCode: 'WH-BULK-STOCK' });
      expect(stock.body.data).toEqual({ onHand: 42, reserved: 0, available: 42 });
    });

    it('re-running with the same quantity is a harmless no-op (delta 0, unchanged snapshot)', async () => {
      const enqueue = await admin.post('/admin/v1/inventory/bulk-set-stock').send({
        warehouseCode: 'WH-BULK-STOCK',
        rows: [{ sku: 'BULK-STOCK-SKU-1', quantity: 42 }],
      });
      const finished = await pollJob(enqueue.body.data.jobId as string);
      expect(finished.result).toMatchObject({ total: 1, succeeded: 1, failed: 0 });

      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'BULK-STOCK-SKU-1' } });
      const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId: variant.publicId, warehouseCode: 'WH-BULK-STOCK' });
      expect(stock.body.data).toEqual({ onHand: 42, reserved: 0, available: 42 });
    });
  });
});
