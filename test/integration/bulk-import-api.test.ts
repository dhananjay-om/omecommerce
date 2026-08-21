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

  describe('bulk product upsert (Magento-style Add/Update CSV, bulk-upsert-products job)', () => {
    const warehouseCode = 'WH-BULK-UPSERT';
    let priceListCode = '';
    let categorySlug = '';

    beforeAll(async () => {
      await prisma.warehouse.upsert({
        where: { code: warehouseCode },
        update: {},
        create: { code: warehouseCode, name: 'Bulk Upsert Test Warehouse' },
      });

      const colorAttr = await prisma.attribute.upsert({
        where: { code: 'bulk-upsert-color' },
        update: {},
        create: { code: 'bulk-upsert-color', label: 'Color', dataType: 'SELECT', inputType: 'DROPDOWN' },
      });
      const existingOption = await prisma.attributeOption.findFirst({ where: { attributeId: colorAttr.id, value: 'RED' } });
      if (!existingOption) {
        await prisma.attributeOption.create({ data: { attributeId: colorAttr.id, value: 'RED', label: 'Red' } });
      }

      const priceListRes = await admin.post('/admin/v1/price-lists').send({
        code: 'PL-BULK-UPSERT-TEST',
        name: 'Bulk Upsert Test Price List',
        currency: 'INR',
      });
      priceListCode = (priceListRes.body.data?.code as string) ?? 'PL-BULK-UPSERT-TEST';

      const categoryRes = await admin.post('/admin/v1/categories').send({ nameDefault: 'Bulk Upsert Test Category' });
      categorySlug = categoryRes.body.data.slug as string;
    });

    it('rejects an empty rows array with 422', async () => {
      const res = await admin.post('/admin/v1/products/bulk-upsert').send({ rows: [] });
      expect(res.status).toBe(422);
    });

    it('creates a new SKU with attributes/category/price/qty in one row, then updates the same SKU on a second import', async () => {
      const createEnqueue = await admin.post('/admin/v1/products/bulk-upsert').send({
        priceListCode,
        warehouseCode,
        rows: [
          {
            sku: 'UPSERT-SKU-1',
            type: 'SIMPLE',
            attributeSetCode: 'bulk-import-test-set',
            nameDefault: 'Upsert Test Product',
            status: 'ACTIVE',
            price: '100.00',
            mrp: '150.00',
            qty: 10,
            categorySlugs: [categorySlug],
            attributes: { 'bulk-upsert-color': 'Red' },
          },
          { sku: 'UPSERT-BAD-SET', type: 'SIMPLE', attributeSetCode: 'does-not-exist-code' }, // row 1: unknown set
        ],
      });
      expect(createEnqueue.status).toBe(202);
      const created = await pollJob(createEnqueue.body.data.jobId as string);
      expect(created.result).toMatchObject({ total: 2, created: 1, updated: 0, failed: 1 });
      const createErrors = (created.result as { errors: Array<{ row: number; sku: string; message: string }> }).errors;
      expect(createErrors).toEqual([{ row: 1, sku: 'UPSERT-BAD-SET', message: expect.stringContaining('does-not-exist-code') }]);

      const product = await prisma.product.findFirstOrThrow({ where: { sku: 'UPSERT-SKU-1' } });
      expect(product.nameDefault).toBe('Upsert Test Product');
      const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } });

      const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId: variant.publicId, warehouseCode });
      expect(stock.body.data).toEqual({ onHand: 10, reserved: 0, available: 10 });

      const prices = await admin.get(`/admin/v1/variants/${variant.publicId}/prices`);
      const ourPrice = (prices.body.data as Array<{ priceListCode: string; price: string; mrp: string }>).find(
        (p) => p.priceListCode === priceListCode,
      );
      expect(ourPrice).toMatchObject({ price: '100.0000', mrp: '150.0000' });

      const colorValue = await prisma.productAttributeValue.findFirst({
        where: { product: { sku: 'UPSERT-SKU-1' }, attribute: { code: 'bulk-upsert-color' } },
      });
      expect(colorValue?.valueInt).not.toBeNull();

      // Second import of the SAME sku: no type/attributeSetCode this time (patch semantics) —
      // must update, not error or re-create.
      const updateEnqueue = await admin.post('/admin/v1/products/bulk-upsert').send({
        priceListCode,
        warehouseCode,
        rows: [{ sku: 'UPSERT-SKU-1', nameDefault: 'Upsert Test Product UPDATED', price: '200.00', qty: 5 }],
      });
      const updated = await pollJob(updateEnqueue.body.data.jobId as string);
      expect(updated.result).toMatchObject({ total: 1, created: 0, updated: 1, failed: 0 });

      const productAfter = await prisma.product.findFirstOrThrow({ where: { sku: 'UPSERT-SKU-1' } });
      expect(productAfter.nameDefault).toBe('Upsert Test Product UPDATED');

      const stockAfter = await admin.get('/admin/v1/inventory/stock').query({ variantId: variant.publicId, warehouseCode });
      expect(stockAfter.body.data.onHand).toBe(5); // absolute set (10 -> 5), not a delta

      const pricesAfter = await admin.get(`/admin/v1/variants/${variant.publicId}/prices`);
      const ourPriceAfter = (pricesAfter.body.data as Array<{ priceListCode: string; price: string }>).find(
        (p) => p.priceListCode === priceListCode,
      );
      expect(ourPriceAfter?.price).toBe('200.0000');
    });

    it('requires type and attributeSetCode to create a brand-new SKU', async () => {
      const enqueue = await admin.post('/admin/v1/products/bulk-upsert').send({
        rows: [{ sku: 'UPSERT-NEVER-CREATED', nameDefault: 'Missing type/set' }],
      });
      const finished = await pollJob(enqueue.body.data.jobId as string);
      expect(finished.result).toMatchObject({ total: 1, created: 0, updated: 0, failed: 1 });
      const exists = await prisma.product.findFirst({ where: { sku: 'UPSERT-NEVER-CREATED' } });
      expect(exists).toBeNull();
    });

    it('fails a row needing price/qty when the job has no price list / warehouse selected', async () => {
      const enqueue = await admin.post('/admin/v1/products/bulk-upsert').send({
        rows: [{ sku: 'UPSERT-SKU-1', price: '1.00' }],
      });
      const finished = await pollJob(enqueue.body.data.jobId as string);
      expect(finished.result).toMatchObject({ total: 1, created: 0, updated: 0, failed: 1 });
    });
  });
});
