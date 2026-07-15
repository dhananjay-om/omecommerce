import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Inventory ledger over HTTP (live DB). Proves the full lifecycle (adjust -> reserve
 * -> commit / release -> expire-sweep) AND the race-safe guarded UPDATE under real
 * concurrent HTTP requests. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('inventory API (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';
  let admin: ReturnType<typeof adminRequest>;

  async function createVariant(sku: string): Promise<string> {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    return variant.publicId;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE stock_reservation, stock_movement, stock_item, store_warehouse, warehouse, product RESTART IDENTITY CASCADE',
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'inventory-test-set' },
      update: {},
      create: { code: 'inventory-test-set', name: 'Inventory Test Set' },
    });
    attributeSetId = set.id.toString();
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a warehouse', async () => {
    const res = await admin
      .post('/admin/v1/warehouses')
      .send({ code: 'WH-LIFECYCLE', name: 'Lifecycle Warehouse' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('WH-LIFECYCLE');
  });

  it('runs the full ledger lifecycle: adjust -> reserve -> commit -> reserve -> release', async () => {
    const variantId = await createVariant('INV-SKU-1');

    // purchase +10
    const purchase = await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', delta: 10, reason: 'PURCHASE' });
    expect(purchase.status).toBe(201);
    expect(purchase.body.data).toEqual({ onHand: 10, reserved: 0, available: 10 });

    // reserve 3 for order #1
    const r1 = await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', qty: 3, refType: 'ORDER', refId: '1' });
    expect(r1.status).toBe(201);
    expect(r1.body.data.reservationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r1.body.data.expiresAt).toBeTruthy();

    let stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-LIFECYCLE' });
    expect(stock.body.data).toEqual({ onHand: 10, reserved: 3, available: 7 });

    // commit -> on_hand -= 3, reserved -= 3
    const commit = await admin.post(`/admin/v1/inventory/reservations/${r1.body.data.reservationId}/commit`);
    expect(commit.status).toBe(204);

    stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-LIFECYCLE' });
    expect(stock.body.data).toEqual({ onHand: 7, reserved: 0, available: 7 });

    // committing again fails (no longer ACTIVE)
    const recommit = await admin.post(`/admin/v1/inventory/reservations/${r1.body.data.reservationId}/commit`);
    expect(recommit.status).toBe(409);

    // reserve 2 for order #2, then release (not commit): on_hand unchanged, reserved back down
    const r2 = await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', qty: 2, refType: 'ORDER', refId: '2' });
    expect(r2.status).toBe(201);

    stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-LIFECYCLE' });
    expect(stock.body.data).toEqual({ onHand: 7, reserved: 2, available: 5 });

    const release = await admin.post(`/admin/v1/inventory/reservations/${r2.body.data.reservationId}/release`);
    expect(release.status).toBe(204);

    stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-LIFECYCLE' });
    expect(stock.body.data).toEqual({ onHand: 7, reserved: 0, available: 7 });

    // negative adjustment (correction) -2
    const correction = await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', delta: -2, reason: 'CORRECTION' });
    expect(correction.status).toBe(201);
    expect(correction.body.data).toEqual({ onHand: 5, reserved: 0, available: 5 });

    // adjustment that would push on_hand negative is rejected (409), not silently clamped
    const overCorrect = await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', delta: -100, reason: 'CORRECTION' });
    expect(overCorrect.status).toBe(409);
    expect(overCorrect.body.type).toContain('insufficient-stock');

    // reserving more than available is rejected
    const overReserve = await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', qty: 999, refType: 'ORDER', refId: '3' });
    expect(overReserve.status).toBe(409);
  });

  it('proves the guarded UPDATE is race-safe under concurrent HTTP reservations', async () => {
    await admin.post('/admin/v1/warehouses').send({ code: 'WH-CONC', name: 'Concurrency Warehouse' });
    const variantId = await createVariant('INV-SKU-CONC-1');
    await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-CONC', delta: 5, reason: 'PURCHASE' });

    // 10 concurrent reservations of qty=1 against on_hand=5 -- exactly 5 must win.
    const attempts = Array.from({ length: 10 }, (_, i) =>
      admin
        .post('/admin/v1/inventory/reservations')
        .send({ variantId, warehouseCode: 'WH-CONC', qty: 1, refType: 'ORDER', refId: String(100 + i) }),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(5);
    expect(rejected).toHaveLength(5);

    const stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-CONC' });
    expect(stock.body.data).toEqual({ onHand: 5, reserved: 5, available: 0 });
  });

  it('sweeps expired reservations without touching still-active ones', async () => {
    await admin.post('/admin/v1/warehouses').send({ code: 'WH-EXPIRY', name: 'Expiry Warehouse' });
    const variantId = await createVariant('INV-SKU-EXPIRY-1');
    await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-EXPIRY', delta: 5, reason: 'PURCHASE' });

    // already-expired reservation (negative TTL)
    await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-EXPIRY', qty: 2, refType: 'ORDER', refId: '1', ttlSeconds: -60 });
    // still-active reservation
    await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-EXPIRY', qty: 1, refType: 'ORDER', refId: '2' });

    let stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-EXPIRY' });
    expect(stock.body.data).toEqual({ onHand: 5, reserved: 3, available: 2 });

    const sweep = await admin.post('/admin/v1/inventory/reservations/sweep-expired');
    expect(sweep.status).toBe(200);
    expect(sweep.body.data.releasedCount).toBeGreaterThanOrEqual(1);

    stock = await admin.get('/admin/v1/inventory/stock').query({ variantId, warehouseCode: 'WH-EXPIRY' });
    // the expired qty=2 reservation was released (reserved -= 2); the active qty=1 remains
    expect(stock.body.data).toEqual({ onHand: 5, reserved: 1, available: 4 });
  });

  it('validates input and 404s on unknown warehouse/variant', async () => {
    const variantId = await createVariant('INV-SKU-VALIDATE-1');

    const zeroDelta = await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', delta: 0, reason: 'PURCHASE' });
    expect(zeroDelta.status).toBe(422);

    const badQty = await admin
      .post('/admin/v1/inventory/reservations')
      .send({ variantId, warehouseCode: 'WH-LIFECYCLE', qty: 0, refType: 'ORDER', refId: '1' });
    expect(badQty.status).toBe(422);

    const unknownWarehouse = await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId, warehouseCode: 'NOPE', delta: 1, reason: 'PURCHASE' });
    expect(unknownWarehouse.status).toBe(404);

    const unknownVariant = await admin
      .get('/admin/v1/inventory/stock')
      .query({ variantId: '00000000-0000-7000-8000-000000000000', warehouseCode: 'WH-LIFECYCLE' });
    expect(unknownVariant.status).toBe(404);
  });
});
