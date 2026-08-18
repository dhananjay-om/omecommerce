import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Placeable marketing banners over HTTP (live DB) — Content > Banners.
 * Proves admin CRUD, soft-delete, and the storefront's active-only,
 * group-filtered, position-ordered read. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('banner API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE banner RESTART IDENTITY CASCADE');
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a banner, defaulting to active', async () => {
    const res = await admin.post('/admin/v1/banners').send({ group: 'HERO', title: 'Big Sale' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ group: 'HERO', title: 'Big Sale', isActive: true, position: 0 });
  });

  it('admin: lists and gets one by publicId', async () => {
    const list = await admin.get('/admin/v1/banners');
    expect(list.status).toBe(200);
    expect(list.body.data.some((b: { title: string }) => b.title === 'Big Sale')).toBe(true);

    const created = list.body.data.find((b: { title: string }) => b.title === 'Big Sale');
    const single = await admin.get(`/admin/v1/banners/${created.publicId}`);
    expect(single.status).toBe(200);
    expect(single.body.data.title).toBe('Big Sale');
  });

  it('mints a presigned upload URL for a banner image', async () => {
    const res = await admin.post('/admin/v1/banners/image-upload-url').send({ group: 'HERO', filename: 'sale.jpg', mimeType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.data.uploadUrl).toEqual(expect.any(String));
    expect(res.body.data.imageMediaKey).toContain('banner-images/hero-');
  });

  it('updates a banner and toggles it inactive', async () => {
    const created = await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Update Me' });
    const res = await admin.put(`/admin/v1/banners/${created.body.data.publicId}`).send({ title: 'Updated', isActive: false, position: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Updated', isActive: false, position: 3 });
  });

  it('store: lists only active banners of one group, ordered by position', async () => {
    await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Promo A', position: 2 });
    await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Promo B', position: 1 });
    const inactive = await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Promo Inactive', position: 0 });
    await admin.put(`/admin/v1/banners/${inactive.body.data.publicId}`).send({ isActive: false });

    const res = await request(app).get('/store/v1/banners').query({ group: 'PROMO' });
    expect(res.status).toBe(200);
    const titles = res.body.data.map((b: { title: string }) => b.title);
    expect(titles).toContain('Promo B');
    expect(titles).toContain('Promo A');
    expect(titles).not.toContain('Promo Inactive');
    expect(titles.indexOf('Promo B')).toBeLessThan(titles.indexOf('Promo A')); // position 1 before position 2

    // Different group is untouched.
    const heroOnly = await request(app).get('/store/v1/banners').query({ group: 'HERO' });
    expect(heroOnly.body.data.some((b: { title: string }) => b.title.startsWith('Promo'))).toBe(false);
  });

  it('admin: soft-deletes a banner — disappears from admin list and storefront read', async () => {
    const created = await admin.post('/admin/v1/banners').send({ group: 'HERO', title: 'Deletable' });
    const del = await admin.delete(`/admin/v1/banners/${created.body.data.publicId}`);
    expect(del.status).toBe(204);

    const getDeleted = await admin.get(`/admin/v1/banners/${created.body.data.publicId}`);
    expect(getDeleted.status).toBe(404);

    const store = await request(app).get('/store/v1/banners').query({ group: 'HERO' });
    expect(store.body.data.some((b: { title: string }) => b.title === 'Deletable')).toBe(false);
  });

  it('accepts and persists a gradient preset, and lets it be cleared on update', async () => {
    const created = await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Gradient Tile', gradient: 'from-blue-600 to-indigo-700' });
    expect(created.status).toBe(201);
    expect(created.body.data.gradient).toBe('from-blue-600 to-indigo-700');

    const store = await request(app).get('/store/v1/banners').query({ group: 'PROMO' });
    const found = store.body.data.find((b: { title: string }) => b.title === 'Gradient Tile');
    expect(found.gradient).toBe('from-blue-600 to-indigo-700');

    // blankToUndefined only kicks in for a *string*; an explicit `null` is
    // how a nullable field is actually cleared via update (same pattern as
    // the admin form's actions.ts sending `gradient || null`, not `''`).
    const cleared = await admin.put(`/admin/v1/banners/${created.body.data.publicId}`).send({ gradient: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.gradient).toBeNull();
  });

  it('422s creating a banner with a gradient value outside the fixed preset list', async () => {
    const res = await admin.post('/admin/v1/banners').send({ group: 'PROMO', title: 'Bad Gradient', gradient: 'not-a-real-class' });
    expect(res.status).toBe(422);
  });

  it('404s deleting a non-existent banner', async () => {
    const res = await admin.delete('/admin/v1/banners/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b');
    expect(res.status).toBe(404);
  });

  it('401s creating a banner with no admin auth', async () => {
    const res = await request(app).post('/admin/v1/banners').send({ group: 'HERO', title: 'x' });
    expect(res.status).toBe(401);
  });

  it('422s creating a banner with an invalid group', async () => {
    const res = await admin.post('/admin/v1/banners').send({ group: 'NOT_A_GROUP', title: 'x' });
    expect(res.status).toBe(422);
  });
});
