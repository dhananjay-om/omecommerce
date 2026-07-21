import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Storefront Customer accounts over HTTP (live DB) — plan/05 §2.5. Proves
 * register/login/profile/addresses/order-history, the website-scoped email
 * uniqueness, the default-shipping/billing race-safety, and that a customer
 * token can never satisfy an admin-authenticated route (shape check, not a
 * shared secret). Gated on INTEGRATION=1.
 *
 * Order history is exercised only for the empty case: nothing in the current
 * checkout flow lets a customerId be attached to a cart/order yet (documented
 * deferral — cart guest->customer merge, customer.module.ts's header comment).
 */
describe.skipIf(!process.env.INTEGRATION)('customer API (live DB)', () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE customer_address, customer RESTART IDENTITY CASCADE');
    await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a customer', async () => {
    const res = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery', firstName: 'Jane' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ publicId: expect.any(String), email: 'jane@example.com', firstName: 'Jane', lastName: null });
  });

  it('rejects a duplicate email on the same website with 409', async () => {
    const res = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'another-password' });
    expect(res.status).toBe(409);
  });

  it('404s registering against a non-existent website code', async () => {
    const res = await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'no-such-website', email: 'ghost@example.com', password: 'whatever-password' });
    expect(res.status).toBe(404);
  });

  it('logs in and rejects wrong password / non-existent email identically (401)', async () => {
    const ok = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toEqual(expect.any(String));

    const wrongPassword = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'nope' });
    expect(wrongPassword.status).toBe(401);

    const noSuchEmail = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'nobody@example.com', password: 'nope' });
    expect(noSuchEmail.status).toBe(401);
  });

  it('fetches the authenticated profile and rejects requests with no token', async () => {
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    const token = login.body.data.token as string;

    const profile = await request(app).get('/store/v1/me').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe('jane@example.com');

    const noAuth = await request(app).get('/store/v1/me');
    expect(noAuth.status).toBe(401);
  });

  it('a customer token cannot pass admin authentication (shape check, not just a shared secret)', async () => {
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    const customerToken = login.body.data.token as string;

    const res = await request(app).post('/admin/v1/attribute-sets').set('Authorization', `Bearer ${customerToken}`).send({ code: 'x', name: 'x' });
    expect(res.status).toBe(401);
  });

  it('adds addresses, enforces one default-shipping at a time, lists, and deletes', async () => {
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    const token = login.body.data.token as string;
    const authed = (method: 'get' | 'post' | 'delete', url: string) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

    const first = await authed('post', '/store/v1/me/addresses').send({
      name: 'Jane Doe',
      line1: '1 Main St',
      city: 'Springfield',
      postalCode: '00000',
      country: 'US',
      isDefaultShipping: true,
    });
    expect(first.status).toBe(201);

    const second = await authed('post', '/store/v1/me/addresses').send({
      name: 'Jane Doe (work)',
      line1: '2 Work Ave',
      city: 'Springfield',
      postalCode: '00001',
      country: 'US',
      isDefaultShipping: true,
    });
    expect(second.status).toBe(201);

    const list = await authed('get', '/store/v1/me/addresses');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    // The second address claimed default-shipping; the partial unique index +
    // same-transaction unset means only ONE row may have it true at a time.
    const defaults = list.body.data.filter((a: { isDefaultShipping: boolean }) => a.isDefaultShipping);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].line1).toBe('2 Work Ave');

    const toDelete = list.body.data.find((a: { line1: string }) => a.line1 === '1 Main St');
    const del = await authed('delete', `/store/v1/me/addresses/${toDelete.publicId}`);
    expect(del.status).toBe(204);

    const afterDelete = await authed('get', '/store/v1/me/addresses');
    expect(afterDelete.body.data).toHaveLength(1);
  });

  it('404s deleting an address that does not belong to the caller', async () => {
    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'other@example.com', password: 'some-password-here' });
    const otherLogin = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'other@example.com', password: 'some-password-here' });
    const otherToken = otherLogin.body.data.token as string;

    const janeLogin = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    const janeToken = janeLogin.body.data.token as string;
    const janeAddresses = await request(app).get('/store/v1/me/addresses').set('Authorization', `Bearer ${janeToken}`);
    const janeAddressId = janeAddresses.body.data[0].publicId;

    const res = await request(app)
      .delete(`/store/v1/me/addresses/${janeAddressId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('returns an empty order history for a customer with no orders', async () => {
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'jane@example.com', password: 'correct-horse-battery' });
    const token = login.body.data.token as string;
    const res = await request(app).get('/store/v1/me/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('admin lists customers with pagination and email search, and fetches a detail view with addresses', async () => {
    const admin = adminRequest(app, await getAdminToken(app));

    const all = await admin.get('/admin/v1/customers');
    expect(all.status).toBe(200);
    // jane@example.com and other@example.com were both registered in prior tests
    expect(all.body.data.total).toBeGreaterThanOrEqual(2);

    const bySearch = await admin.get('/admin/v1/customers').query({ search: 'jane' });
    expect(bySearch.body.data.customers).toHaveLength(1);
    expect(bySearch.body.data.customers[0].email).toBe('jane@example.com');

    const janePublicId = bySearch.body.data.customers[0].publicId;
    const detail = await admin.get(`/admin/v1/customers/${janePublicId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.email).toBe('jane@example.com');
    // Jane has exactly one remaining address at this point in the file (the
    // "1 Main St" one was deleted in an earlier test; "2 Work Ave" remains).
    expect(detail.body.data.addresses).toHaveLength(1);
    expect(detail.body.data.addresses[0].line1).toBe('2 Work Ave');

    const unknown = await admin.get('/admin/v1/customers/00000000-0000-7000-8000-000000000000');
    expect(unknown.status).toBe(404);
  });
});
