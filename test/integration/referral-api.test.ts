import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Worker } from 'bullmq';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';
import { OutboxRelay } from '../../src/shared/infrastructure/outbox/outbox-relay.js';
import { getDomainEventsQueue } from '../../src/shared/infrastructure/queue/queues.js';
import { startReferralQualifyWorker } from '../../src/workers/referral-qualify.worker.js';

/**
 * Referral program over HTTP (live DB) — plan/11 §3 (completes plan/11;
 * Loyalty was Stage 5b). Proves admin program creation, self-service code
 * lazy-creation, attach (happy path, double-attach 409, self-referral 422,
 * max-referrals 409), a referee reward issued immediately at attach, a
 * SIGNUP-qualifying program rewarding both sides at attach with no order
 * needed, a FIRST_ORDER-qualifying program rewarding the referrer only after
 * a real qualifying checkout (a below-minimum order does not qualify; a
 * later qualifying order does), a flat (not proportional) clawback on
 * refund of the qualifying order, and attribution-window expiry.
 *
 * Automatic qualify/clawback is worker-driven off the Order module's outbox
 * — inherently async, so, as the same documented exception
 * loyalty-api.test.ts/bulk-import-api.test.ts already establish, this file
 * starts the real referral-qualify worker itself and manually pumps the
 * outbox relay after each checkout/refund, then polls the storefront
 * endpoint for the expected post-worker state. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('referral API (live DB)', () => {
  const app = createApp();
  const relay = new OutboxRelay(prisma, getDomainEventsQueue());
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let storeViewId = '';
  let storeId = 0n;
  let worker: Worker;

  const address = { name: 'Jane Doe', line1: '123 Main St', city: 'Springfield', postalCode: '12345', country: 'US' };

  async function createVariant(sku: string, price: string): Promise<string> {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.post('/admin/v1/price-lists').send({ code: `PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    return variant.publicId;
  }

  async function registerAndLogin(email: string): Promise<{ token: string; publicId: string }> {
    await request(app).post('/store/v1/customers').send({ websiteCode: 'us_retail', email, password: 'correct-horse-battery' });
    const login = await request(app).post('/store/v1/customers/actions/login').send({ websiteCode: 'us_retail', email, password: 'correct-horse-battery' });
    return { token: login.body.data.token as string, publicId: login.body.data.customerPublicId as string };
  }

  async function checkoutAsCustomer(customerPublicId: string, email: string, variantId: string, qty: number): Promise<{ orderPublicId: string; grandTotal: string }> {
    const cart = await request(app).post('/store/v1/carts').send({ storeViewId, customerPublicId });
    const cartId = cart.body.data.publicId;
    await request(app).post(`/store/v1/carts/${cartId}/lines`).send({ variantId, qty });
    const checkout = await request(app)
      .post(`/store/v1/carts/${cartId}/checkout`)
      .send({ email, billingAddress: address, shippingAddress: address, shippingMethodCode: 'REF-SHIP', paymentMethod: 'test_card' });
    expect(checkout.status).toBe(201);
    await relay.pollOnce();
    return { orderPublicId: checkout.body.data.publicId, grandTotal: checkout.body.data.grandTotal };
  }

  async function pollReferral(token: string, predicate: (data: Record<string, unknown>) => boolean, timeoutMs = 8000): Promise<Record<string, unknown>> {
    const start = Date.now();
    for (;;) {
      const res = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${token}`);
      const referral = (res.body.data.referrals as Array<Record<string, unknown>>)[0];
      if (referral && predicate(referral)) return referral;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`referral did not reach the expected state within ${timeoutMs}ms (last: ${JSON.stringify(referral)})`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async function walletBalance(token: string): Promise<string> {
    const res = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${token}`);
    return res.body.data.balance as string;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE referral_reward, referral, referral_code, referral_program,
       loyalty_transaction, loyalty_account, loyalty_tier, loyalty_program,
       wallet_transaction, wallet,
       order_return_line, order_return, fulfillment_line, fulfillment, payment_transaction,
       order_tax_line, order_address, order_line, "order", cart_line, cart,
       tax_class, shipping_method, price_tier, product_price, price_list,
       stock_reservation, stock_movement, stock_item, product,
       customer_address, customer,
       outbox_event RESTART IDENTITY CASCADE`,
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'referral-test-set' },
      update: {},
      create: { code: 'referral-test-set', name: 'Referral Test Set' },
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

    await admin.post('/admin/v1/warehouses').send({ code: 'REF-WH', name: 'Referral Warehouse' });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'REF-WH' } });
    await prisma.storeWarehouse.deleteMany({ where: { storeId } });
    await prisma.storeWarehouse.create({ data: { storeId, warehouseId: warehouse.id, priority: 0 } });
    // $0 shipping so grandTotal == subtotal, keeping the minOrderAmount comparisons exact.
    await admin.post('/admin/v1/shipping-methods').send({ code: 'REF-SHIP', name: 'Referral Shipping', flatRate: '0.00', currency: 'USD' });

    worker = startReferralQualifyWorker();
  });

  afterAll(async () => {
    await worker.close();
    await prisma.$disconnect();
  });

  it('creates a loyalty program (needed for the POINTS-typed referee reward) and a referral program', async () => {
    const loyalty = await admin.post('/admin/v1/loyalty/programs').send({
      websiteCode: 'us_retail',
      name: 'OME Rewards',
      pointsPerCurrencyUnit: '1',
      pointValue: '0.01',
    });
    expect(loyalty.status).toBe(201);

    const program = await admin.post('/admin/v1/referral/programs').send({
      websiteCode: 'us_retail',
      name: 'OME Referrals',
      qualifyingEvent: 'FIRST_ORDER',
      minOrderAmount: '40.00',
      attributionWindowDays: 1,
      maxReferralsPerCustomer: 2,
      referrerRewardType: 'STORE_CREDIT',
      referrerRewardAmount: '10.00',
      refereeRewardType: 'POINTS',
      refereeRewardPoints: '100',
    });
    expect(program.status).toBe(201);
    expect(program.body.data).toMatchObject({ name: 'OME Referrals', qualifyingEvent: 'FIRST_ORDER', referrerRewardType: 'STORE_CREDIT', refereeRewardType: 'POINTS' });
  });

  it('rejects a second referral program for the same website with 409', async () => {
    const res = await admin.post('/admin/v1/referral/programs').send({
      websiteCode: 'us_retail',
      name: 'Duplicate',
      referrerRewardType: 'STORE_CREDIT',
      referrerRewardAmount: '1.00',
      refereeRewardType: 'STORE_CREDIT',
      refereeRewardAmount: '1.00',
    });
    expect(res.status).toBe(409);
  });

  it('rejects a POINTS reward type with no configured amount, or with a zero amount', async () => {
    // A fresh, program-less website — 'us_retail' already has a program by
    // this point, and the "already exists" 409 check runs before reward-shape
    // validation, so it would mask these validation failures otherwise.
    await prisma.website.upsert({
      where: { code: 'ref_validation_test' },
      update: {},
      create: { code: 'ref_validation_test', name: 'Referral Validation Test', baseCurrency: 'USD', isDefault: false },
    });

    const missing = await admin.post('/admin/v1/referral/programs').send({
      websiteCode: 'ref_validation_test',
      name: 'Bad',
      referrerRewardType: 'POINTS',
      refereeRewardType: 'STORE_CREDIT',
      refereeRewardAmount: '1.00',
    });
    expect(missing.status).toBe(422);

    const zero = await admin.post('/admin/v1/referral/programs').send({
      websiteCode: 'ref_validation_test',
      name: 'Bad2',
      referrerRewardType: 'STORE_CREDIT',
      referrerRewardAmount: '0',
      refereeRewardType: 'STORE_CREDIT',
      refereeRewardAmount: '1.00',
    });
    expect(zero.status).toBe(422);
  });

  it('rejects storefront referral routes with no auth', async () => {
    const res = await request(app).get('/store/v1/me/referrals');
    expect(res.status).toBe(401);
  });

  it('lazy-creates a referral code on first request', async () => {
    const referrer = await registerAndLogin('referrer1@example.com');
    const res = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.code).toEqual(expect.any(String));
    expect(res.body.data.code.length).toBeGreaterThanOrEqual(6);
    expect(res.body.data.referrals).toEqual([]);
  });

  it('attaches a referral code and issues the referee reward immediately', async () => {
    const referrer = await registerAndLogin('referrer1@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    const referee = await registerAndLogin('referee1a@example.com');
    const attach = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${referee.token}`).send({ code });
    expect(attach.status).toBe(200);
    expect(attach.body.data.status).toBe('SIGNED_UP');
    expect(attach.body.data.refereeReward).toMatchObject({ beneficiary: 'REFEREE', rewardType: 'POINTS', points: '100' });

    // referee's loyalty account (Stage 5b) should show the 100 points immediately.
    const loyalty = await request(app).get('/store/v1/me/loyalty').set('Authorization', `Bearer ${referee.token}`);
    expect(loyalty.body.data.pointsBalance).toBe('100');
  });

  it('rejects attaching the same code twice for the same referee with 409', async () => {
    const referrer = await registerAndLogin('referrer1@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    const referee = await registerAndLogin('referee1a@example.com');
    const res = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${referee.token}`).send({ code });
    expect(res.status).toBe(409);
  });

  it('rejects a customer attaching their own referral code with 422', async () => {
    const referrer = await registerAndLogin('referrer2@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    const res = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${referrer.token}`).send({ code });
    expect(res.status).toBe(422);
  });

  it('does not qualify a below-minimum order, and later qualifies + rewards the referrer + claws back on refund', async () => {
    const referrer = await registerAndLogin('referrer1@example.com');
    const referee = await registerAndLogin('referee1a@example.com');

    const belowMinVariant = await createVariant('REF-SKU-LOW', '20.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: belowMinVariant, warehouseCode: 'REF-WH', delta: 5, reason: 'PURCHASE' });
    const belowMin = await checkoutAsCustomer(referee.publicId, 'referee1a@example.com', belowMinVariant, 1);
    expect(belowMin.grandTotal).toBe('20.0000'); // below the $40 minOrderAmount

    // Give the worker a moment to process, then confirm it stayed SIGNED_UP (a fixed short wait, not a poll-for-change, since nothing SHOULD change here).
    await new Promise((r) => setTimeout(r, 1000));
    const stillSignedUp = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    expect(stillSignedUp.body.data.referrals[0]).toMatchObject({ status: 'SIGNED_UP', referrerReward: null });

    const qualifyingVariant = await createVariant('REF-SKU-QUALIFY', '50.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: qualifyingVariant, warehouseCode: 'REF-WH', delta: 5, reason: 'PURCHASE' });
    const qualifying = await checkoutAsCustomer(referee.publicId, 'referee1a@example.com', qualifyingVariant, 1);
    expect(qualifying.grandTotal).toBe('50.0000'); // >= the $40 minOrderAmount

    const rewarded = await pollReferral(referrer.token, (r) => r.status === 'REWARDED');
    expect(rewarded.referrerReward).toMatchObject({ beneficiary: 'REFERRER', rewardType: 'STORE_CREDIT', amount: '10.0000' });
    expect(await walletBalance(referrer.token)).toBe('10.0000');

    const refund = await admin.post(`/admin/v1/orders/${qualifying.orderPublicId}/refunds`).send({ lines: [{ sku: 'REF-SKU-QUALIFY', qty: 1 }], restock: true });
    expect(refund.status).toBe(200);
    await relay.pollOnce();

    await pollReferral(referrer.token, (r) => r.status === 'REVERSED');
    expect(await walletBalance(referrer.token)).toBe('0.0000');
  });

  it('rejects attaching once maxReferralsPerCustomer is reached', async () => {
    const referrer = await registerAndLogin('referrer1@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    // referee1a (already attached above) is referral #1 for referrer1; this is #2, hitting the cap of 2.
    const second = await registerAndLogin('referee1b@example.com');
    const secondAttach = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${second.token}`).send({ code });
    expect(secondAttach.status).toBe(200);

    const third = await registerAndLogin('referee1c@example.com');
    const thirdAttach = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${third.token}`).send({ code });
    expect(thirdAttach.status).toBe(409);
  });

  it('expires a referral once its attribution window has passed, without rewarding the referrer', async () => {
    const referrer = await registerAndLogin('referrer4@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    const referee = await registerAndLogin('referee4@example.com');
    await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${referee.token}`).send({ code });

    // Backdate the referral past its 1-day attribution window (no clock-mocking available in this suite).
    await prisma.referral.updateMany({
      where: { referee: { publicId: referee.publicId } },
      data: { createdAt: new Date(Date.now() - 5 * 86_400_000) },
    });

    const qualifyingVariant = await createVariant('REF-SKU-EXPIRE', '50.00');
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId: qualifyingVariant, warehouseCode: 'REF-WH', delta: 5, reason: 'PURCHASE' });
    await checkoutAsCustomer(referee.publicId, 'referee4@example.com', qualifyingVariant, 1);

    const expired = await pollReferral(referrer.token, (r) => r.status === 'EXPIRED');
    expect(expired.referrerReward).toBeNull();
    expect(await walletBalance(referrer.token)).toBe('0.0000');
  });

  it('rewards both sides immediately at attach for a SIGNUP-qualifying program', async () => {
    await prisma.website.upsert({
      where: { code: 'us_signup_test' },
      update: {},
      create: { code: 'us_signup_test', name: 'Signup Test', baseCurrency: 'USD', isDefault: false },
    });
    await admin.post('/admin/v1/referral/programs').send({
      websiteCode: 'us_signup_test',
      name: 'Signup Referrals',
      qualifyingEvent: 'SIGNUP',
      referrerRewardType: 'STORE_CREDIT',
      referrerRewardAmount: '5.00',
      refereeRewardType: 'STORE_CREDIT',
      refereeRewardAmount: '5.00',
    });

    async function registerOnSignupWebsite(email: string): Promise<{ token: string; publicId: string }> {
      await request(app).post('/store/v1/customers').send({ websiteCode: 'us_signup_test', email, password: 'correct-horse-battery' });
      const login = await request(app).post('/store/v1/customers/actions/login').send({ websiteCode: 'us_signup_test', email, password: 'correct-horse-battery' });
      return { token: login.body.data.token as string, publicId: login.body.data.customerPublicId as string };
    }

    const referrer = await registerOnSignupWebsite('signup-referrer@example.com');
    const codeRes = await request(app).get('/store/v1/me/referrals').set('Authorization', `Bearer ${referrer.token}`);
    const code = codeRes.body.data.code as string;

    const referee = await registerOnSignupWebsite('signup-referee@example.com');
    const attach = await request(app).post('/store/v1/me/referrals/actions/attach').set('Authorization', `Bearer ${referee.token}`).send({ code });
    expect(attach.status).toBe(200);
    expect(attach.body.data.status).toBe('REWARDED');
    expect(attach.body.data.refereeReward).toMatchObject({ rewardType: 'STORE_CREDIT', amount: '5.0000' });

    expect(await walletBalance(referrer.token)).toBe('5.0000');
    expect(await walletBalance(referee.token)).toBe('5.0000');
  });
});
