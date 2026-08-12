import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Storefront Wishlists over HTTP (live DB) — plan/05 §2.6. Proves multi-
 * wishlist support, idempotent add, ownership isolation between customers,
 * and 404 on a non-existent product. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('wishlist API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let productPublicId = '';
  let customerToken = '';
  let otherCustomerToken = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE wishlist_item, wishlist, customer_address, customer RESTART IDENTITY CASCADE');
    await prisma.$executeRawUnsafe(
      'TRUNCATE price_tier, product_price, price_list, product RESTART IDENTITY CASCADE',
    );
    await prisma.website.upsert({
      where: { code: 'us_retail' },
      update: {},
      create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
    });
    const set = await prisma.attributeSet.upsert({
      where: { code: 'wishlist-test-set' },
      update: {},
      create: { code: 'wishlist-test-set', name: 'Wishlist Test Set' },
    });
    attributeSetId = set.id.toString();
    admin = adminRequest(app, await getAdminToken(app));

    const product = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'WISH-SKU-1', attributeSetId, status: 'ACTIVE', nameDefault: 'Wishlisted Widget' });
    productPublicId = product.body.data.publicId;

    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'wisher@example.com', password: 'correct-horse-battery' });
    const login = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'wisher@example.com', password: 'correct-horse-battery' });
    customerToken = login.body.data.token;

    await request(app)
      .post('/store/v1/customers')
      .send({ websiteCode: 'us_retail', email: 'other-wisher@example.com', password: 'another-password-1' });
    const otherLogin = await request(app)
      .post('/store/v1/customers/actions/login')
      .send({ websiteCode: 'us_retail', email: 'other-wisher@example.com', password: 'another-password-1' });
    otherCustomerToken = otherLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects wishlist routes with no auth', async () => {
    const res = await request(app).get('/store/v1/me/wishlists');
    expect(res.status).toBe(401);
  });

  it('creates a wishlist, defaulting the name', async () => {
    const res = await request(app).post('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`).send({});
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ publicId: expect.any(String), name: 'default', items: [] });
  });

  it('creates a second, named wishlist', async () => {
    const res = await request(app)
      .post('/store/v1/me/wishlists')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Birthday' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Birthday');
  });

  it('lists both wishlists, empty', async () => {
    const res = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((w: { items: unknown[] }) => w.items.length === 0)).toBe(true);
  });

  it('adds a product to a wishlist, idempotently', async () => {
    const list = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    const wishlistId = list.body.data[0].publicId;

    const add = await request(app)
      .post(`/store/v1/me/wishlists/${wishlistId}/items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productPublicId });
    expect(add.status).toBe(204);

    // Adding the same product again is a no-op, not a 409.
    const addAgain = await request(app)
      .post(`/store/v1/me/wishlists/${wishlistId}/items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productPublicId });
    expect(addAgain.status).toBe(204);

    const after = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    const target = after.body.data.find((w: { publicId: string }) => w.publicId === wishlistId);
    expect(target.items).toHaveLength(1);
    expect(target.items[0]).toEqual({
      productId: productPublicId,
      sku: 'WISH-SKU-1',
      name: 'Wishlisted Widget',
      addedAt: expect.any(String),
    });
  });

  it('404s adding a non-existent product', async () => {
    const list = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    const wishlistId = list.body.data[0].publicId;
    const res = await request(app)
      .post(`/store/v1/me/wishlists/${wishlistId}/items`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: '00000000-0000-7000-8000-000000000000' });
    expect(res.status).toBe(404);
  });

  it("404s adding to another customer's wishlist (ownership isolation)", async () => {
    const list = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    const wishlistId = list.body.data[0].publicId;
    const res = await request(app)
      .post(`/store/v1/me/wishlists/${wishlistId}/items`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ productId: productPublicId });
    expect(res.status).toBe(404);
  });

  it('removes an item, then 404s removing it again', async () => {
    const list = await request(app).get('/store/v1/me/wishlists').set('Authorization', `Bearer ${customerToken}`);
    const wishlistId = list.body.data[0].publicId;

    const del = await request(app)
      .delete(`/store/v1/me/wishlists/${wishlistId}/items/${productPublicId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(del.status).toBe(204);

    const again = await request(app)
      .delete(`/store/v1/me/wishlists/${wishlistId}/items/${productPublicId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(again.status).toBe(404);
  });
});
