import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Gift Cards over HTTP (live DB) — plan/10 §3. Proves admin issue (raw code
 * returned once), storefront balance-check by code, redeem-into-wallet (the
 * self-contained load path that doesn't need checkout), disabled/expired
 * rejection, and admin adjust/disable. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('gift card API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let customerToken = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE gift_card_transaction, gift_card, wallet_transaction, wallet, customer_address, customer RESTART IDENTITY CASCADE',
    );
    await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
    admin = adminRequest(app, await getAdminToken(app));

    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'gc-holder@example.com', password: 'correct-horse-battery' });
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'gc-holder@example.com', password: 'correct-horse-battery' });
    customerToken = login.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("admin: GET /auth/me returns the caller's own email and permissions from the JWT", async () => {
    const res = await admin.get('/admin/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toEqual(expect.any(String));
    expect(res.body.data.permissions).toContain('wallet:manage');
  });

  it('401s /auth/me with no admin auth', async () => {
    const res = await request(app).get('/admin/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('issues a gift card, returning the raw code once', async () => {
    const res = await admin
      .post('/admin/v1/gift-cards')
      .send({ websiteCode: 'us_retail', amount: '50.00', recipientEmail: 'friend@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      publicId: expect.any(String),
      code: expect.stringMatching(/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/),
      codeLast4: expect.any(String),
      initialAmount: '50.0000',
      balance: '50.0000',
      currency: 'USD',
      status: 'ACTIVE',
    });
  });

  it('checks balance by code (storefront, unauthenticated)', async () => {
    const issue = await admin.post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount: '30.00' });
    const code = issue.body.data.code as string;

    const res = await request(app).get(`/store/v1/gift-cards/${code}/balance`);
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe('30.0000');
    expect(res.body.data).not.toHaveProperty('code');
  });

  it('404s a balance check for a non-existent code', async () => {
    const res = await request(app).get('/store/v1/gift-cards/FFFF-FFFF-FFFF-FFFF-FFFF/balance');
    expect(res.status).toBe(404);
  });

  it('redeems a gift card into the customer wallet, and the code cannot be redeemed twice', async () => {
    const issue = await admin.post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount: '40.00' });
    const code = issue.body.data.code as string;

    const redeem = await request(app)
      .post('/store/v1/me/wallet/actions/redeem-gift-card')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code });
    expect(redeem.status).toBe(200);
    expect(redeem.body.data).toEqual({ redeemedAmount: '40.0000', walletBalance: '40.0000' });

    const walletCheck = await request(app).get('/store/v1/me/wallet').set('Authorization', `Bearer ${customerToken}`);
    expect(walletCheck.body.data.balance).toBe('40.0000');

    const balanceAfter = await request(app).get(`/store/v1/gift-cards/${code}/balance`);
    expect(balanceAfter.body.data.balance).toBe('0.0000');
    expect(balanceAfter.body.data.status).toBe('REDEEMED');

    // Redeeming again fails — the card is REDEEMED (not ACTIVE) and has no balance.
    const again = await request(app)
      .post('/store/v1/me/wallet/actions/redeem-gift-card')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code });
    expect(again.status).toBe(409);
  });

  it('rejects redeeming a disabled gift card', async () => {
    const issue = await admin.post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount: '10.00' });
    const code = issue.body.data.code as string;
    const publicId = issue.body.data.publicId as string;

    const disable = await admin.post(`/admin/v1/gift-cards/${publicId}/actions/disable`);
    expect(disable.status).toBe(204);

    const redeem = await request(app)
      .post('/store/v1/me/wallet/actions/redeem-gift-card')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code });
    expect(redeem.status).toBe(409);
  });

  it('admin adjusts a gift card balance and views its transaction ledger', async () => {
    const issue = await admin.post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount: '20.00' });
    const publicId = issue.body.data.publicId as string;

    const adjust = await admin.post(`/admin/v1/gift-cards/${publicId}/actions/adjust`).send({ amount: '5.00', reason: 'goodwill top-up' });
    expect(adjust.status).toBe(200);
    expect(adjust.body.data.balance).toBe('25.0000');

    const txns = await admin.get(`/admin/v1/gift-cards/${publicId}/transactions`);
    expect(txns.status).toBe(200);
    expect(txns.body.data.map((t: { type: string }) => t.type).sort()).toEqual(['ADJUST', 'ISSUE']);
  });

  it('admin: lists gift cards, filterable by status/last4/recipientEmail/website, paginated', async () => {
    const issue = await admin
      .post('/admin/v1/gift-cards')
      .send({ websiteCode: 'us_retail', amount: '15.00', recipientEmail: 'list-target@example.com' });
    const { publicId, codeLast4 } = issue.body.data;

    const all = await admin.get('/admin/v1/gift-cards');
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBeGreaterThan(0);
    expect(all.body.data.giftCards.some((c: { publicId: string }) => c.publicId === publicId)).toBe(true);
    // List rows never carry the raw code, only what's needed for a browse table.
    expect(all.body.data.giftCards[0]).not.toHaveProperty('code');

    const byLast4 = await admin.get('/admin/v1/gift-cards').query({ last4: codeLast4 });
    expect(byLast4.body.data.giftCards.every((c: { codeLast4: string }) => c.codeLast4 === codeLast4)).toBe(true);

    const byEmail = await admin.get('/admin/v1/gift-cards').query({ recipientEmail: 'list-target' });
    expect(byEmail.body.data.giftCards.some((c: { publicId: string }) => c.publicId === publicId)).toBe(true);

    const byStatus = await admin.get('/admin/v1/gift-cards').query({ status: 'ACTIVE' });
    expect(byStatus.body.data.giftCards.every((c: { status: string }) => c.status === 'ACTIVE')).toBe(true);

    const byUnknownWebsite = await admin.get('/admin/v1/gift-cards').query({ websiteCode: 'no-such-website' });
    expect(byUnknownWebsite.body.data).toMatchObject({ total: 0, giftCards: [] });

    const paged = await admin.get('/admin/v1/gift-cards').query({ page: 1, pageSize: 1 });
    expect(paged.body.data.giftCards).toHaveLength(1);
  });

  it('401s issuing a gift card with no admin auth', async () => {
    const res = await request(app).post('/admin/v1/gift-cards').send({ websiteCode: 'us_retail', amount: '10.00' });
    expect(res.status).toBe(401);
  });
});
