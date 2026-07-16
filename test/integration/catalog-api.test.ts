import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Full Catalog vertical slice over HTTP (live DB). Proves: create product ->
 * assign GLOBAL + STORE_VIEW attribute values -> storefront read resolves the
 * STORE_VIEW override. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('catalog API (live DB)', () => {
  const app = createApp();
  let storeViewId = '';
  let attributeSetId = '';
  let admin: ReturnType<typeof adminRequest>;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE product RESTART IDENTITY CASCADE');

    await prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
    });
    const lang = await prisma.language.upsert({
      where: { code: 'en-US' },
      update: {},
      create: { code: 'en-US', name: 'English', nativeName: 'English' },
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
    const sv = await prisma.storeView.upsert({
      where: { storeId_code: { storeId: store.id, code: 'en' } },
      update: {},
      create: { storeId: store.id, code: 'en', languageId: lang.id, currency: 'USD' },
    });
    const set = await prisma.attributeSet.upsert({
      where: { code: 'electronics' },
      update: {},
      create: { code: 'electronics', name: 'Electronics', isDefault: true },
    });
    await prisma.attribute.upsert({
      where: { code: 'ram' },
      update: {},
      create: { code: 'ram', label: 'RAM', dataType: 'NUMBER', inputType: 'NUMBER' },
    });
    storeViewId = sv.id.toString();
    attributeSetId = set.id.toString();
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a product, assigns scoped values, resolves the STORE_VIEW override', async () => {
    // create
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'API-SKU-1', attributeSetId, nameDefault: 'Phone A', status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const publicId = created.body.data.publicId as string;
    expect(publicId).toMatch(/^[0-9a-f-]{36}$/);

    // assign GLOBAL ram = 8
    const g = await admin
      .put(`/admin/v1/products/${publicId}/attributes`)
      .send({ attributeCode: 'ram', scope: 'GLOBAL', value: 8 });
    expect(g.status).toBe(204);

    // assign STORE_VIEW ram = 16
    const s = await admin
      .put(`/admin/v1/products/${publicId}/attributes`)
      .send({ attributeCode: 'ram', scope: 'STORE_VIEW', storeViewId, value: 16 });
    expect(s.status).toBe(204);

    // storefront read resolves the override (16) — unauthenticated, no admin token
    const read = await request(app).get(`/store/v1/products/${publicId}?storeViewId=${storeViewId}`);
    expect(read.status).toBe(200);
    expect(read.body.data.sku).toBe('API-SKU-1');
    expect(read.body.data.currency).toBe('USD');
    expect(read.body.data.attributes.ram).toBe(16);
  });

  it('re-assigning the same scope updates (upsert), not duplicates', async () => {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-2', attributeSetId });
    const publicId = created.body.data.publicId as string;

    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'ram', scope: 'GLOBAL', value: 4 });
    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'ram', scope: 'GLOBAL', value: 12 });

    const read = await request(app).get(`/store/v1/products/${publicId}?storeViewId=${storeViewId}`);
    expect(read.body.data.attributes.ram).toBe(12);
  });

  it('rejects duplicate SKU with 409', async () => {
    const dup = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-1', attributeSetId });
    expect(dup.status).toBe(409);
    expect(dup.body.type).toContain('conflict');
  });

  it('validates a wrong-typed attribute value with 422', async () => {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-3', attributeSetId });
    const publicId = created.body.data.publicId as string;
    const bad = await admin
      .put(`/admin/v1/products/${publicId}/attributes`)
      .send({ attributeCode: 'ram', scope: 'GLOBAL', value: 'not-a-number' });
    expect(bad.status).toBe(422);
  });

  it('lists a SIMPLE product\'s implicitly-created variant (admin browse — was previously undiscoverable via any API)', async () => {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-4', attributeSetId });
    const publicId = created.body.data.publicId as string;

    const variants = await admin.get(`/admin/v1/products/${publicId}/variants`);
    expect(variants.status).toBe(200);
    expect(variants.body.data).toHaveLength(1);
    expect(variants.body.data[0]).toMatchObject({ sku: 'API-SKU-4', status: 'ACTIVE', position: 0 });
    expect(variants.body.data[0].publicId).toEqual(expect.any(String));
  });

  it('404s listing variants for an unknown product', async () => {
    const res = await admin.get('/admin/v1/products/00000000-0000-7000-8000-000000000000/variants');
    expect(res.status).toBe(404);
  });
});
