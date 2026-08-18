import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Worker } from 'bullmq';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';
import { OutboxRelay } from '../../src/shared/infrastructure/outbox/outbox-relay.js';
import { getDomainEventsQueue } from '../../src/shared/infrastructure/queue/queues.js';
import { startLoyaltyEarnWorker } from '../../src/workers/loyalty-earn.worker.js';

/**
 * Loyalty program over HTTP (live DB) — plan/11 §2 (Loyalty only this pass;
 * Referral is its own later Stage 5c). Proves admin program/tier creation,
 * automatic points earning on a real paid checkout, tier upgrade on crossing
 * a threshold, proportional clawback on refund (full and partial),
 * redeem-to-wallet, and insufficient-points/below-minimum rejection.
 *
 * Automatic earn is worker-driven off the Order module's outbox — inherently
 * async, so, as an explicit scoped exception (same one bulk-import-api.test.ts
 * already documents), this file starts the real loyalty-earn worker itself
 * and manually pumps the outbox relay after each checkout/refund (same
 * `relay.pollOnce()` pattern stage3-infra.test.ts uses to prove outbox
 * behavior), then polls the storefront account endpoint for the expected
 * post-worker state. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('loyalty API (live DB)', () => {
  const app = createApp();
  const relay = new OutboxRelay(prisma, getDomainEventsQueue());
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let storeViewId = '';
  let storeId = 0n;
  let worker: Worker;

  let customerPublicId = '';
  let customerToken = '';
  let programPublicId = '';
  let orderAPublicId = ''; // qty 1 @ $50, no tier yet — used for the full-refund clawback test
  let orderBPublicId = ''; // qty 2 @ $50, crosses the Silver threshold — used for the partial-refund clawback test

  const address = { name: 'Jane Doe', line1: '123 Main St', city: 'Springfield', postalCode: '12345', country: 'US' };

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    return variant.publicId;
  }

  async function checkoutAsCustomer(variantId: string, qty: number): Promise<{ orderPublicId: string; grandTotal: string }> {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty });
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({
        email: 'loyalty-buyer@example.com',
        billingAddress: address,
        shippingAddress: address,
        shippingMethodCode: 'LOY-SHIP',
        paymentMethod: 'test_card',
      });
    expect(checkout.status).toBe(201);
    await relay.pollOnce(); // relay OrderPlaced + OrderPaid so the loyalty-earn worker can pick them up
    return { orderPublicId: checkout.body.data.publicId, grandTotal: checkout.body.data.grandTotal };
  }

  async function pollLoyalty(predicate: (data: Record<string, unknown>) => boolean, timeoutMs = 8000): Promise<Record<string, unknown>> {
    const start = Date.now();
    for (;;) {
      const res = await request(app).get('/store/v1/me/loyalty').set('Authorization', `Bearer ${customerToken}`);
      if (predicate(res.body.data)) return res.body.data;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`loyalty account did not reach the expected state within ${timeoutMs}ms (last: ${JSON.stringify(res.body.data)})`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE loyalty_transaction, loyalty_account, loyalty_tier, loyalty_program,
       wallet_transaction, wallet,
       order_return_line, order_return, fulfillment_line, fulfillment, payment_transaction,
       order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer,
       outbox_event RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'loyalty-test-set' },
      update: {},
      create: { code: 'loyalty-test-set', name: 'Loyalty Test Set' },
    });
    attributeSetId = set.id.toString();

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
    });
    const website = await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
    const store = await prisma.store.upsert({
      where: { websiteId_code: { websiteId: website.id, code: 'main' } },
      update: {},
      create: { websiteId: website.id, code: 'main', name: 'Main' },
    });
    storeId = store.id;
    const lang = await prisma.language.upsert({
      where: { code: 'en-US' },
      update: {},
      create: { code: 'en-US', name: 'English', nativeName: 'English' },
    });
    const sv = await prisma.storeView.upsert({
      where: { storeId_code: { storeId: store.id, code: 'en' } },
      update: {},
      create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'USD' },
    });
    storeViewId = sv.id.toString();

    admin = adminRequest(app, await getAdminToken(app));

    await admin.post('/admin/v1/warehouses').send({ code: 'LOY-WH', name: 'Loyalty Warehouse' });
    // Same deterministic-mapping precaution order-api.test.ts/stage3-infra.test.ts
    // document: WarehouseResolver's "first active warehouse" fallback only
    // applies with NO store_warehouse mapping at all, so an explicit mapping is
    // needed once any other file has created one first.
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'LOY-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId } });
    await prisma.storeWarehouse.create({ data: { storeId, warehouseId: warehouse.id, priority: 0 } });
    // $0 shipping so grandTotal == subtotal, keeping the clawback math exact:
    // RefundOrder's refund amount is unitPrice*qty (+ proportional tax), which
    // excludes shipping — a $0 shipping method means grandTotal has no
    // shipping component to diverge from.
    await admin.post('/admin/v1/shipping-methods').send({ code: 'LOY-SHIP', name: 'Loyalty Shipping', flatRate: '0.00', currency: 'USD' });

    const reg = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'loyalty-buyer@example.com', password: 'correct-horse-battery' });
    customerPublicId = reg.body.data.publicId;
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'loyalty-buyer@example.com', password: 'correct-horse-battery' });
    customerToken = login.body.data.token;

    worker = startLoyaltyEarnWorker();
  });

  afterAll(async () => {
    await worker.close();
    await prisma.$disconnect();
  });

  it('creates a loyalty program for a website', async () => {
    const res = await admin.post('/admin/v1/loyalty/programs').send({
      websiteCode: 'us_retail',
      name: 'OME Rewards',
      pointsPerCurrencyUnit: '1',
      pointValue: '0.01',
      redeemMinPoints: 50,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'OME Rewards', pointsPerCurrencyUnit: '1.0000', pointValue: '0.0100', redeemMinPoints: 50 });
    programPublicId = res.body.data.publicId;
  });

  it('rejects a second program for the same website with 409', async () => {
    const res = await admin.post('/admin/v1/loyalty/programs').send({
      websiteCode: 'us_retail',
      name: 'Duplicate Program',
      pointsPerCurrencyUnit: '1',
      pointValue: '0.01',
    });
    expect(res.status).toBe(409);
  });

  it('creates tiers under the program', async () => {
    const silver = await admin
      .post(`/admin/v1/loyalty/programs/${programPublicId}/tiers`)
      .send({ name: 'Silver', thresholdPoints: '100', earnMultiplier: '1.5' });
    expect(silver.status).toBe(201);
    expect(silver.body.data).toMatchObject({ name: 'Silver', thresholdPoints: '100', earnMultiplier: '1.5000' });

    const gold = await admin
      .post(`/admin/v1/loyalty/programs/${programPublicId}/tiers`)
      .send({ name: 'Gold', thresholdPoints: '500', earnMultiplier: '2' });
    expect(gold.status).toBe(201);
    expect(gold.body.data).toMatchObject({ name: 'Gold', thresholdPoints: '500', earnMultiplier: '2.0000' });
  });

  it('admin: lists and gets loyalty programs, and updates one', async () => {
    const list = await admin.get('/admin/v1/loyalty/programs');
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { publicId: string }) => p.publicId === programPublicId)).toBe(true);

    const single = await admin.get(`/admin/v1/loyalty/programs/${programPublicId}`);
    expect(single.status).toBe(200);
    expect(single.body.data).toMatchObject({ name: 'OME Rewards', status: 'ACTIVE', pointsExpiryMonths: null });

    const updated = await admin.patch(`/admin/v1/loyalty/programs/${programPublicId}`).send({ name: 'OME Rewards Plus', pointsExpiryMonths: 12 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'OME Rewards Plus', pointsExpiryMonths: 12 });

    // Restore the name — later tests/assertions don't depend on it, but keep state predictable for anyone reading this file top-to-bottom.
    await admin.patch(`/admin/v1/loyalty/programs/${programPublicId}`).send({ name: 'OME Rewards' });
  });

  it('admin: lists tiers, updates one, and deletes one (re-tiering the account to null on next earn)', async () => {
    const list = await admin.get(`/admin/v1/loyalty/programs/${programPublicId}/tiers`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((t: { name: string }) => t.name).sort()).toEqual(['Gold', 'Silver']);
    const silver = list.body.data.find((t: { name: string }) => t.name === 'Silver');

    const updated = await admin.patch(`/admin/v1/loyalty/programs/${programPublicId}/tiers/${silver.id}`).send({ earnMultiplier: '1.5' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Silver', earnMultiplier: '1.5000' });

    const throwaway = await admin
      .post(`/admin/v1/loyalty/programs/${programPublicId}/tiers`)
      .send({ name: 'Throwaway', thresholdPoints: '999999' });
    const del = await admin.delete(`/admin/v1/loyalty/programs/${programPublicId}/tiers/${throwaway.body.data.id}`);
    expect(del.status).toBe(204);

    const listAfter = await admin.get(`/admin/v1/loyalty/programs/${programPublicId}/tiers`);
    expect(listAfter.body.data.some((t: { name: string }) => t.name === 'Throwaway')).toBe(false);
  });

  it('rejects storefront loyalty routes with no auth', async () => {
    const res = await request(app).get('/store/v1/me/loyalty');
    expect(res.status).toBe(401);
  });

  it('a fresh customer has a zero-balance loyalty account (lazy-created, not 404)', async () => {
    const res = await request(app).get('/store/v1/me/loyalty').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pointsBalance: '0', lifetimePoints: '0', tier: null, status: 'ACTIVE' });
  });

  it('earns points automatically on a paid checkout, with no manual trigger', async () => {
    const variantId = await createVariant('LOY-SKU-1', '50.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'LOY-WH', delta: 10, reason: 'PURCHASE' });

    const { orderPublicId, grandTotal } = await checkoutAsCustomer(variantId, 1);
    expect(grandTotal).toBe('50.0000');
    orderAPublicId = orderPublicId;

    const account = await pollLoyalty((d) => d.pointsBalance === '50');
    expect(account).toMatchObject({ pointsBalance: '50', lifetimePoints: '50', tier: null });

    const txns = await request(app).get('/store/v1/me/loyalty/transactions').set('Authorization', `Bearer ${customerToken}`);
    expect(txns.status).toBe(200);
    expect(txns.body.data[0]).toMatchObject({ type: 'EARN', points: '50', balanceAfter: '50', source: 'ORDER' });
  });

  it('crosses a tier threshold on a second purchase and is upgraded automatically', async () => {
    const variantId = await createVariant('LOY-SKU-2', '50.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'LOY-WH', delta: 10, reason: 'PURCHASE' });

    // $100 at the still-base 1x multiplier (no tier before this order): 50 (lifetime so far) + 100 = 150 >= Silver's 100.
    const { orderPublicId, grandTotal } = await checkoutAsCustomer(variantId, 2);
    expect(grandTotal).toBe('100.0000');
    orderBPublicId = orderPublicId;

    const account = await pollLoyalty((d) => d.lifetimePoints === '150');
    expect(account).toMatchObject({ pointsBalance: '150', lifetimePoints: '150' });
    expect(account.tier).toMatchObject({ name: 'Silver' });
  });

  it('earns at the tier multiplier once upgraded', async () => {
    const variantId = await createVariant('LOY-SKU-3', '50.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'LOY-WH', delta: 10, reason: 'PURCHASE' });

    // $50 * Silver's 1.5x multiplier = 75.
    const { grandTotal } = await checkoutAsCustomer(variantId, 1);
    expect(grandTotal).toBe('50.0000');

    const account = await pollLoyalty((d) => d.lifetimePoints === '225');
    expect(account).toMatchObject({ pointsBalance: '225', lifetimePoints: '225' });
  });

  it('claws back points proportionally on a full refund', async () => {
    const refund = await admin.post(`/admin/v1/orders/${orderAPublicId}/refunds`).send({ lines: [{ sku: 'LOY-SKU-1', qty: 1 }], restock: true });
    expect(refund.status).toBe(200);
    expect(refund.body.data.financialStatus).toBe('REFUNDED');
    await relay.pollOnce();

    // order A earned 50 points on a $50 grandTotal (no shipping/tax); refunding
    // the whole line refunds the whole $50 -> full 1:1 reversal of the 50 points.
    const account = await pollLoyalty((d) => d.pointsBalance === '175');
    expect(account.pointsBalance).toBe('175');
    expect(account.lifetimePoints).toBe('225'); // lifetimePoints (the tier basis) is never reduced by a refund
  });

  it('claws back points proportionally on a partial refund', async () => {
    const refund = await admin.post(`/admin/v1/orders/${orderBPublicId}/refunds`).send({ lines: [{ sku: 'LOY-SKU-2', qty: 1 }], restock: true });
    expect(refund.status).toBe(200);
    expect(refund.body.data.financialStatus).toBe('PARTIALLY_REFUNDED');
    await relay.pollOnce();

    // order B earned 100 points on a $100 grandTotal; refunding 1 of its 2 lines
    // refunds $50 (half) -> half of the 100 points (50) are reversed.
    const account = await pollLoyalty((d) => d.pointsBalance === '125');
    expect(account.pointsBalance).toBe('125');
  });

  it('redeems points into wallet store credit', async () => {
    const res = await request(app)
      .post('/store/v1/me/loyalty/actions/redeem')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ points: '100' });
    expect(res.status).toBe(200);
    // 100 points * program.pointValue (0.01) = $1.00.
    expect(res.body.data).toEqual({ redeemedPoints: '100', storeCreditAmount: '1.0000', walletBalance: '1.0000' });

    const account = await pollLoyalty((d) => d.pointsBalance === '25');
    expect(account.pointsBalance).toBe('25');

    const wallet = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${customerToken}`);
    expect(wallet.body.data.balance).toBe('1.0000');
  });

  it('rejects redeeming below the program minimum with 422', async () => {
    const res = await request(app)
      .post('/store/v1/me/loyalty/actions/redeem')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ points: '10' }); // below redeemMinPoints (50)
    expect(res.status).toBe(422);
  });

  it('rejects redeeming more points than the balance holds with 409', async () => {
    const res = await request(app)
      .post('/store/v1/me/loyalty/actions/redeem')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ points: '50' }); // at/above min, but current balance is only 25
    expect(res.status).toBe(409);
  });

  it('lets an admin view and manually adjust a customer loyalty account', async () => {
    const before = await admin.get(`/admin/v1/customers/${customerPublicId}/loyalty`);
    expect(before.status).toBe(200);
    expect(before.body.data.pointsBalance).toBe('25');

    const grant = await admin
      .post(`/admin/v1/customers/${customerPublicId}/loyalty/actions/adjust`)
      .send({ points: '20', reason: 'goodwill grant' });
    expect(grant.status).toBe(200);
    expect(grant.body.data.pointsBalance).toBe('45');

    const correction = await admin
      .post(`/admin/v1/customers/${customerPublicId}/loyalty/actions/adjust`)
      .send({ points: '-10', reason: 'correcting an over-grant' });
    expect(correction.status).toBe(200);
    expect(correction.body.data.pointsBalance).toBe('35');

    const txns = await admin.get(`/admin/v1/customers/${customerPublicId}/loyalty/transactions`);
    expect(txns.status).toBe(200);
    expect(txns.body.data[0]).toMatchObject({ type: 'ADJUST', points: '-10', balanceAfter: '35', source: 'ADMIN' });
  });
});
