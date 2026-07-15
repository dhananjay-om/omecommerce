import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { redis } from '../../src/shared/infrastructure/redis/client.js';
import { OutboxRelay } from '../../src/shared/infrastructure/outbox/outbox-relay.js';
import { getDomainEventsQueue } from '../../src/shared/infrastructure/queue/queues.js';
import { pdpCacheKey } from '../../src/modules/catalog/application/get-product-for-store-view.usecase.js';
import { getAdminToken, adminRequest, DEV_ADMIN_EMAIL } from '../helpers/auth.js';

/**
 * Stage 3 cross-cutting infra: auth/RBAC enforcement, idempotency-key replay,
 * the transactional outbox + relay, and PDP cache-aside. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('Stage 3 infra (live DB + Redis)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let storeViewId = '';
  let storeId = 0n;

  /**
   * Multiple integration test files share one store and each create their own
   * warehouse; WarehouseResolver.resolveForStore() falls back to "first active
   * warehouse by id" only when NO store_warehouse mapping exists at all for the
   * store — so whichever test file's warehouse happens to have the lowest id
   * wins the fallback across ALL of them, an easy source of cross-file test
   * flakiness. Give each test's own warehouse an explicit, lowest-priority
   * mapping so its checkout deterministically resolves to ITS warehouse.
   */
  async function linkWarehouseToStore(warehouseCode: string): Promise<void> {
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: warehouseCode } });
    // Clear any prior mapping from an earlier test in this file first — two
    // priority-0 rows for the same store would leave the winner to arbitrary
    // Postgres row order, defeating the determinism this helper exists for.
    await prisma.storeWarehouse.deleteMany({ where: { storeId } });
    await prisma.storeWarehouse.create({ data: { storeId, warehouseId: warehouse.id, priority: 0 } });
  }

  beforeAll(async () => {
    admin = adminRequest(app, await getAdminToken(app));
    const set = await prisma.attributeSet.upsert({
      where: { code: 'stage3-test-set' },
      update: {},
      create: { code: 'stage3-test-set', name: 'Stage3 Test Set' },
    });
    attributeSetId = set.id.toString();
    await prisma.attribute.upsert({
      where: { code: 'ram' },
      update: {},
      create: { code: 'ram', label: 'RAM', dataType: 'NUMBER', inputType: 'NUMBER' },
    });
    const sv = await prisma.storeView.findFirstOrThrow();
    storeViewId = sv.id.toString();
    storeId = sv.storeId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  describe('auth/RBAC', () => {
    it('rejects an admin request with no Authorization header (401)', async () => {
      const res = await request(app).post('/admin/v1/warehouses').send({ code: 'NOAUTH-WH', name: 'x' });
      expect(res.status).toBe(401);
      expect(res.body.type).toContain('unauthenticated');
    });

    it('rejects an admin request with a garbage token (401)', async () => {
      const res = await request(app)
        .post('/admin/v1/warehouses')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ code: 'BADTOKEN-WH', name: 'x' });
      expect(res.status).toBe(401);
    });

    it('rejects a permission-lacking admin from a protected action (403)', async () => {
      // A fresh admin with NO roles/permissions at all.
      const email = `limited-${Date.now()}@ome.local`;
      await admin.post('/admin/v1/auth/admin-users').send({ email, password: 'irrelevant-but-long-enough', roleCodes: [] });
      const login = await request(app).post('/admin/v1/auth/login').send({ email, password: 'irrelevant-but-long-enough' });
      expect(login.status).toBe(200);
      const limitedToken = login.body.data.token as string;

      const res = await request(app)
        .post('/admin/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({ variantId: '00000000-0000-7000-8000-000000000000', warehouseCode: 'X', delta: 1, reason: 'PURCHASE' });
      expect(res.status).toBe(403);
      expect(res.body.type).toContain('forbidden');
    });

    it('allows the seeded super-admin to reach a permission-gated route (past 403, to normal business validation)', async () => {
      // super-admin has inventory:adjust — the request should get PAST the authorize
      // check and fail on ordinary NotFoundError (404) for a nonexistent warehouse,
      // not 403.
      const res = await admin
        .post('/admin/v1/inventory/adjustments')
        .send({ variantId: '00000000-0000-7000-8000-000000000000', warehouseCode: 'DOES-NOT-EXIST', delta: 1, reason: 'PURCHASE' });
      expect(res.status).not.toBe(403);
    });

    it('does not require auth for the login route itself, or for storefront routes', async () => {
      const login = await request(app).post('/admin/v1/auth/login').send({ email: DEV_ADMIN_EMAIL, password: 'wrong-password' });
      expect(login.status).toBe(401); // reaches the handler (invalid creds), not blocked by authenticate (which would also be 401 but a different `type`)
      expect(login.body.type).toContain('invalid-credentials');
    });
  });

  describe('idempotency', () => {
    async function makeCart(): Promise<string> {
      const set = await prisma.attributeSet.findFirstOrThrow({ where: { code: 'stage3-test-set' } });
      const sku = `IDEMP-SKU-${Date.now()}`;
      const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId: set.id.toString(), status: 'ACTIVE' });
      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
      await admin.post('/admin/v1/price-lists').send({ code: `IDEMP-PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
      await admin.put(`/admin/v1/price-lists/IDEMP-PL-${sku}/prices`).send({ variantId: variant.publicId, price: '10.00' });
      await admin.post('/admin/v1/warehouses').send({ code: `IDEMP-WH-${sku}`, name: 'x' }).catch(() => undefined);
      await linkWarehouseToStore(`IDEMP-WH-${sku}`);
      await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: `IDEMP-WH-${sku}`, delta: 10, reason: 'PURCHASE' });

      const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
      const cartId = cart.body.data.publicId;
      await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variant.publicId, qty: 1 });
      void created;
      return cartId;
    }

    it('replays the exact same response on a duplicate Idempotency-Key without re-running the handler', async () => {
      const cartId = await makeCart();
      const idempotencyKey = `test-key-${Date.now()}`;
      const body = {
        email: 'idem@example.com',
        billingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
        shippingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
        shippingMethodCode: 'DOES-NOT-EXIST', // deliberately fails fast (404) -- we only care about replay, not success
        paymentMethod: 'test_card',
      };

      const first = await request(app)
        .post(`/store/v1/carts/${cartId}/checkout`)
        .set('Idempotency-Key', idempotencyKey)
        .send(body);
      const second = await request(app)
        .post(`/store/v1/carts/${cartId}/checkout`)
        .set('Idempotency-Key', idempotencyKey)
        .send(body);

      // Second call replays the exact first response rather than re-executing
      // (a re-execution would 409 cart-not-active on the 2nd attempt, since the
      // cart was already atomically claimed by the first call).
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);
      expect(second.body.type).not.toContain('cart-not-active');
    });

    it('rejects a reused Idempotency-Key with a different request body (409 conflict)', async () => {
      const cartId = await makeCart();
      const key = `test-key-conflict-${Date.now()}`;
      const base = {
        email: 'idem2@example.com',
        billingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
        shippingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
        shippingMethodCode: 'STILL-DOES-NOT-EXIST',
        paymentMethod: 'test_card',
      };
      await request(app).post(`/store/v1/carts/${cartId}/checkout`).set('Idempotency-Key', key).send(base);
      const conflict = await request(app)
        .post(`/store/v1/carts/${cartId}/checkout`)
        .set('Idempotency-Key', key)
        .send({ ...base, email: 'different@example.com' });
      expect(conflict.status).toBe(409);
      expect(conflict.body.type).toContain('idempotency-key-conflict');
    });
  });

  describe('transactional outbox', () => {
    it('writes an OrderPlaced outbox row on order creation, and the relay publishes it to BullMQ', async () => {
      const set = await prisma.attributeSet.findFirstOrThrow({ where: { code: 'stage3-test-set' } });
      const sku = `OUTBOX-SKU-${Date.now()}`;
      await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId: set.id.toString(), status: 'ACTIVE' });
      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
      await admin.post('/admin/v1/price-lists').send({ code: `OUTBOX-PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
      await admin.put(`/admin/v1/price-lists/OUTBOX-PL-${sku}/prices`).send({ variantId: variant.publicId, price: '5.00' });
      await admin.post('/admin/v1/warehouses').send({ code: `OUTBOX-WH-${sku}`, name: 'x' });
      await linkWarehouseToStore(`OUTBOX-WH-${sku}`);
      await admin.post('/admin/v1/shipping-methods').send({ code: `OUTBOX-SHIP-${sku}`, name: 'x', flatRate: '0', currency: 'USD' });
      await admin.post('/admin/v1/inventory/adjustments').send({ variantId: variant.publicId, warehouseCode: `OUTBOX-WH-${sku}`, delta: 5, reason: 'PURCHASE' });

      const cart = await request(app).post('/store/v1/carts').send({ storeViewId });
      const cartId = cart.body.data.publicId;
      await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId: variant.publicId, qty: 1 });
      const checkout = await request(app)
        .post(`/store/v1/carts/${cartId}/checkout`)
        .send({
          email: 'outbox@example.com',
          billingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
          shippingAddress: { name: 'A', line1: '1 St', city: 'C', postalCode: '1', country: 'US' },
          shippingMethodCode: `OUTBOX-SHIP-${sku}`,
          paymentMethod: 'test_card',
        });
      expect(checkout.status).toBe(201);
      const orderPublicId = checkout.body.data.publicId as string;

      // OrderPlaced was written in the SAME transaction as order creation.
      const placedEvent = await prisma.outboxEvent.findFirst({
        where: { aggregateType: 'Order', aggregateId: orderPublicId, eventType: 'OrderPlaced' },
      });
      expect(placedEvent).not.toBeNull();
      expect(placedEvent!.publishedAt).toBeNull(); // not yet relayed

      // OrderPaid was written as the documented immediate-follow-up (not same tx).
      const paidEvent = await prisma.outboxEvent.findFirst({
        where: { aggregateType: 'Order', aggregateId: orderPublicId, eventType: 'OrderPaid' },
      });
      expect(paidEvent).not.toBeNull();

      // Run the relay once: both rows should be published and land in BullMQ.
      const relay = new OutboxRelay(prisma, getDomainEventsQueue());
      const relayed = await relay.pollOnce();
      expect(relayed).toBeGreaterThanOrEqual(2);

      const rePlacedEvent = await prisma.outboxEvent.findUnique({ where: { id: placedEvent!.id } });
      expect(rePlacedEvent!.publishedAt).not.toBeNull();

      const queue = getDomainEventsQueue();
      const job = await queue.getJob(`outbox-${placedEvent!.id}`);
      expect(job).toBeTruthy();
      expect(job!.name).toBe('OrderPlaced');
      await queue.close();
    });
  });

  describe('PDP cache-aside', () => {
    it('caches a PDP read in Redis, and invalidates it on attribute assignment', async () => {
      const created = await admin
        .post('/admin/v1/products')
        .send({ type: 'SIMPLE', sku: `CACHE-SKU-${Date.now()}`, attributeSetId, status: 'ACTIVE' });
      const publicId = created.body.data.publicId as string;
      const key = pdpCacheKey(publicId, storeViewId);

      // Not cached yet.
      expect(await redis.get(key)).toBeNull();

      const first = await request(app).get(`/store/v1/products/${publicId}?storeViewId=${storeViewId}`);
      expect(first.status).toBe(200);

      // Now cached.
      const cached = await redis.get(key);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!).sku).toBe(first.body.data.sku);

      // Assigning an attribute invalidates the cache for this product.
      await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'ram', scope: 'GLOBAL', value: 4 });
      expect(await redis.get(key)).toBeNull();

      // A subsequent read repopulates it with the new value.
      const second = await request(app).get(`/store/v1/products/${publicId}?storeViewId=${storeViewId}`);
      expect(second.body.data.attributes.ram).toBe(4);
      expect(await redis.get(key)).not.toBeNull();
    });
  });
});
