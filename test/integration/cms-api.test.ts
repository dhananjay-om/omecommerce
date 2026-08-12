import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * CMS pages/blocks over HTTP (live DB) — plan/05 §2.7. Proves store-view
 * override vs. global fallback, draft exclusion, and publish/unpublish.
 * Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('CMS API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let storeViewId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE cms_page, cms_block RESTART IDENTITY CASCADE');
    admin = adminRequest(app, await getAdminToken(app));

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('404s reading a page that does not exist yet', async () => {
    const res = await request(app).get('/store/v1/content/pages/about-us').query({ storeViewId });
    expect(res.status).toBe(404);
  });

  it('creates a global page in DRAFT, and it is not readable until published', async () => {
    const create = await admin.post('/admin/v1/cms/pages').send({ handle: 'about-us', title: 'About Us', body: '<p>Hello</p>' });
    expect(create.status).toBe(201);
    expect(create.body.data.status).toBe('DRAFT');

    const unpublished = await request(app).get('/store/v1/content/pages/about-us').query({ storeViewId });
    expect(unpublished.status).toBe(404);

    const publish = await admin.put(`/admin/v1/cms/pages/${create.body.data.publicId}`).send({ status: 'PUBLISHED' });
    expect(publish.status).toBe(200);
    expect(publish.body.data.publishedAt).toEqual(expect.any(String));

    const published = await request(app).get('/store/v1/content/pages/about-us').query({ storeViewId });
    expect(published.status).toBe(200);
    expect(published.body.data.title).toBe('About Us');
  });

  it('rejects a duplicate global page for the same handle with 409', async () => {
    const res = await admin.post('/admin/v1/cms/pages').send({ handle: 'about-us', title: 'Dup', body: 'x' });
    expect(res.status).toBe(409);
  });

  it('a store-view-specific page overrides the global fallback for the same handle', async () => {
    const override = await admin
      .post('/admin/v1/cms/pages')
      .send({ storeViewId, handle: 'about-us', title: 'About Us (this store)', body: '<p>Store-specific</p>' });
    expect(override.status).toBe(201);
    await admin.put(`/admin/v1/cms/pages/${override.body.data.publicId}`).send({ status: 'PUBLISHED' });

    const resolved = await request(app).get('/store/v1/content/pages/about-us').query({ storeViewId });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.title).toBe('About Us (this store)');

    // A different, non-existent store view still gets the global fallback.
    const otherStoreView = await request(app).get('/store/v1/content/pages/about-us').query({ storeViewId: '999999' });
    expect(otherStoreView.status).toBe(200);
    expect(otherStoreView.body.data.title).toBe('About Us');
  });

  it('unpublishing hides the page again', async () => {
    const create = await admin.post('/admin/v1/cms/pages').send({ handle: 'temp-page', title: 'Temp', body: 'x' });
    await admin.put(`/admin/v1/cms/pages/${create.body.data.publicId}`).send({ status: 'PUBLISHED' });
    const visible = await request(app).get('/store/v1/content/pages/temp-page').query({ storeViewId });
    expect(visible.status).toBe(200);

    await admin.put(`/admin/v1/cms/pages/${create.body.data.publicId}`).send({ status: 'DRAFT' });
    const hidden = await request(app).get('/store/v1/content/pages/temp-page').query({ storeViewId });
    expect(hidden.status).toBe(404);
  });

  it('creates and publishes a reusable block, readable by code', async () => {
    const create = await admin.post('/admin/v1/cms/blocks').send({ code: 'footer-note', body: '<p>(c) 2026</p>' });
    expect(create.status).toBe(201);
    await admin.put(`/admin/v1/cms/blocks/${create.body.data.publicId}`).send({ status: 'PUBLISHED' });

    const res = await request(app).get('/store/v1/content/blocks/footer-note').query({ storeViewId });
    expect(res.status).toBe(200);
    expect(res.body.data.body).toBe('<p>(c) 2026</p>');
  });

  it('401s creating a page with no admin auth', async () => {
    const res = await request(app).post('/admin/v1/cms/pages').send({ handle: 'no-auth', title: 'x', body: 'x' });
    expect(res.status).toBe(401);
  });
});
