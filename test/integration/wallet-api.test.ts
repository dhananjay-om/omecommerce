import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Wallet / Store Credit over HTTP (live DB) — plan/10 §4. Proves admin
 * credit/adjust/freeze, storefront balance/transactions read, insufficient-
 * balance rejection, frozen-wallet rejection, and the guarded-UPDATE debit
 * being race-safe under real concurrent HTTP requests (mirroring
 * inventory-api.test.ts's existing race test). Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('wallet API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let customerPublicId = '';
  let customerToken = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE wallet_transaction, wallet, customer_address, customer RESTART IDENTITY CASCADE');
    await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
    admin = adminRequest(app, await getAdminToken(app));

    const reg = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'wallet-holder@example.com', password: 'correct-horse-battery' });
    customerPublicId = reg.body.data.publicId;
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'wallet-holder@example.com', password: 'correct-horse-battery' });
    customerToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('a fresh customer has a zero-balance wallet (lazy-created, not 404)', async () => {
    const res = await admin.get(`/admin/v1/customers/${customerPublicId}/wallet`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ publicId: expect.any(String), balance: '0.0000', currency: 'USD', status: 'ACTIVE' });
  });

  it('rejects wallet routes with no auth (storefront)', async () => {
    const res = await request(app).get('/store/v1/me/wallet');
    expect(res.status).toBe(401);
  });

  it('admin credits store credit; customer sees it via storefront', async () => {
    const credit = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/credit`)
      .send({ amount: '25.00', bucket: 'STORE_CREDIT', source: 'GOODWILL', reason: 'apology for late shipment' });
    expect(credit.status).toBe(200);
    expect(credit.body.data.balance).toBe('25.0000');

    const storefront = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${customerToken}`);
    expect(storefront.status).toBe(200);
    expect(storefront.body.data.balance).toBe('25.0000');

    const txns = await admin.get(`/admin/v1/customers/${customerPublicId}/wallet/transactions`);
    expect(txns.status).toBe(200);
    expect(txns.body.data).toHaveLength(1);
    expect(txns.body.data[0]).toMatchObject({ bucket: 'STORE_CREDIT', type: 'CREDIT', amount: '25.0000', source: 'GOODWILL' });
  });

  it('admin adjusts the wallet down (negative), and a customer-facing transaction list reflects it', async () => {
    const adjust = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/adjust`)
      .send({ amount: '-5.00', bucket: 'STORE_CREDIT', reason: 'correcting an over-credit' });
    expect(adjust.status).toBe(200);
    expect(adjust.body.data.balance).toBe('20.0000');

    const txns = await request(app).get('/store/v1/me/wallet/transactions').set('Authorization', `Bearer ${customerToken}`);
    expect(txns.body.data).toHaveLength(2);
    expect(txns.body.data[0]).toMatchObject({ type: 'ADJUST', amount: '-5.0000' });
  });

  it('rejects an adjustment that would overdraw the balance with 409', async () => {
    const res = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/adjust`)
      .send({ amount: '-9999.00', bucket: 'STORE_CREDIT', reason: 'too much' });
    expect(res.status).toBe(409);
  });

  it('freezing the wallet blocks further debits; unfreezing restores them', async () => {
    const freeze = await admin.post(`/admin/v1/customers/${customerPublicId}/wallet/actions/freeze`);
    expect(freeze.status).toBe(204);

    const blocked = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/adjust`)
      .send({ amount: '-1.00', bucket: 'STORE_CREDIT', reason: 'should be blocked' });
    expect(blocked.status).toBe(409);

    const unfreeze = await admin.post(`/admin/v1/customers/${customerPublicId}/wallet/actions/unfreeze`);
    expect(unfreeze.status).toBe(204);

    const allowed = await admin
      .post(`/admin/v1/customers/${customerPublicId}/wallet/actions/adjust`)
      .send({ amount: '-1.00', bucket: 'STORE_CREDIT', reason: 'should work now' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.balance).toBe('19.0000');
  });

  it('proves the guarded UPDATE is race-safe under concurrent HTTP debits', async () => {
    const reg = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'race-wallet@example.com', password: 'a-fine-password-1' });
    const raceCustomerId = reg.body.data.publicId as string;
    await admin
      .post(`/admin/v1/customers/${raceCustomerId}/wallet/actions/credit`)
      .send({ amount: '5.00', bucket: 'STORE_CREDIT', source: 'GOODWILL' });

    // 10 concurrent debits of $1.00 against a $5.00 balance -- exactly 5 must win.
    const attempts = Array.from({ length: 10 }, () =>
      admin
        .post(`/admin/v1/customers/${raceCustomerId}/wallet/actions/adjust`)
        .send({ amount: '-1.00', bucket: 'STORE_CREDIT', reason: 'concurrent debit' }),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r.status === 200);
    const rejected = results.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(5);
    expect(rejected).toHaveLength(5);

    const final = await admin.get(`/admin/v1/customers/${raceCustomerId}/wallet`);
    expect(final.body.data.balance).toBe('0.0000');
  });
});
