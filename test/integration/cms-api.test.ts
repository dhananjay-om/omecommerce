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

  it('admin: lists pages and gets one by publicId', async () => {
    const list = await admin.get('/admin/v1/cms/pages');
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { handle: string }) => p.handle === 'about-us')).toBe(true);

    const created = list.body.data.find((p: { handle: string }) => p.handle === 'about-us');
    const single = await admin.get(`/admin/v1/cms/pages/${created.publicId}`);
    expect(single.status).toBe(200);
    expect(single.body.data.handle).toBe('about-us');
  });

  it('admin: soft-deletes a page — disappears from list/get, handle becomes reusable, storefront 404s', async () => {
    const create = await admin.post('/admin/v1/cms/pages').send({ handle: 'deletable-page', title: 'Deletable', body: 'x' });
    await admin.put(`/admin/v1/cms/pages/${create.body.data.publicId}`).send({ status: 'PUBLISHED' });

    const del = await admin.delete(`/admin/v1/cms/pages/${create.body.data.publicId}`);
    expect(del.status).toBe(204);

    const getDeleted = await admin.get(`/admin/v1/cms/pages/${create.body.data.publicId}`);
    expect(getDeleted.status).toBe(404);

    const list = await admin.get('/admin/v1/cms/pages');
    expect(list.body.data.some((p: { publicId: string }) => p.publicId === create.body.data.publicId)).toBe(false);

    const storefront = await request(app).get('/store/v1/content/pages/deletable-page').query({ storeViewId });
    expect(storefront.status).toBe(404);

    // The handle is free again for a new page.
    const recreate = await admin.post('/admin/v1/cms/pages').send({ handle: 'deletable-page', title: 'Reborn', body: 'y' });
    expect(recreate.status).toBe(201);
  });

  it('404s deleting a non-existent page', async () => {
    const res = await admin.delete('/admin/v1/cms/pages/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b');
    expect(res.status).toBe(404);
  });

  it('admin: lists blocks, gets one by publicId, and soft-deletes it', async () => {
    const create = await admin.post('/admin/v1/cms/blocks').send({ code: 'deletable-block', body: '<p>x</p>' });
    expect(create.status).toBe(201);

    const list = await admin.get('/admin/v1/cms/blocks');
    expect(list.status).toBe(200);
    expect(list.body.data.some((b: { code: string }) => b.code === 'deletable-block')).toBe(true);

    const single = await admin.get(`/admin/v1/cms/blocks/${create.body.data.publicId}`);
    expect(single.status).toBe(200);
    expect(single.body.data.code).toBe('deletable-block');

    const del = await admin.delete(`/admin/v1/cms/blocks/${create.body.data.publicId}`);
    expect(del.status).toBe(204);

    const getDeleted = await admin.get(`/admin/v1/cms/blocks/${create.body.data.publicId}`);
    expect(getDeleted.status).toBe(404);

    const listAfter = await admin.get('/admin/v1/cms/blocks');
    expect(listAfter.body.data.some((b: { publicId: string }) => b.publicId === create.body.data.publicId)).toBe(false);
  });

  it('mints a presigned upload URL for an inline rich-text-editor image', async () => {
    const res = await admin.post('/admin/v1/cms/image-upload-url').send({ filename: 'inline.jpg', mimeType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.data.uploadUrl).toEqual(expect.any(String));
    expect(res.body.data.imageMediaKey).toContain('cms-images/');
  });

  it('resolves a data-media-key inline image to a fresh presigned src on every read', async () => {
    const create = await admin
      .post('/admin/v1/cms/pages')
      .send({ handle: 'inline-image-page', title: 'Inline Image', body: '<p>before</p><img data-media-key="cms-images/test-key.png" src="blob:stale"><p>after</p>' });
    expect(create.status).toBe(201);

    // The saved body keeps the data-media-key attribute, but src is re-presigned (no longer the stale local blob: URL saved by the client).
    const single = await admin.get(`/admin/v1/cms/pages/${create.body.data.publicId}`);
    expect(single.body.data.body).toContain('data-media-key="cms-images/test-key.png"');
    expect(single.body.data.body).not.toContain('src="blob:stale"');
    expect(single.body.data.body).toContain('cms-images');
    expect(single.body.data.body).toContain('test-key.png');
    expect(single.body.data.body).toMatch(/src="https?:\/\/[^"]+"/);
  });
});
