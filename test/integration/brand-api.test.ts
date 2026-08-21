import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Brand admin CRUD + storefront browse over HTTP (live DB) — plan/14 Phase 0b.
 * Same shape/discipline as the Category API (plan/13 Phase K), minus the tree.
 * Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('brand API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let productPublicId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE brand RESTART IDENTITY CASCADE');

    const set = await prisma.attributeSet.upsert({
      where: { code: 'brand-test-set' },
      update: {},
      create: { code: 'brand-test-set', name: 'Brand Test Set' },
    });
    const product = await prisma.product.create({
      data: { type: 'SIMPLE', sku: `BRAND-TEST-${Date.now()}`, slug: `brand-test-${Date.now()}`, attributeSetId: set.id, status: 'DRAFT', visibility: 'BOTH' },
    });
    productPublicId = product.publicId;
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a brand with an auto-generated slug', async () => {
    const res = await admin.post('/admin/v1/brands').send({ name: 'Acme Corp', description: 'Makes everything' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      publicId: expect.any(String),
      slug: 'acme-corp',
      name: 'Acme Corp',
      description: 'Makes everything',
      createdAt: expect.any(String),
    });
  });

  it('disambiguates a slug collision with a numeric suffix', async () => {
    const res = await admin.post('/admin/v1/brands').send({ name: 'Acme Corp' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('acme-corp-2');
  });

  it('lists brands (admin)', async () => {
    const res = await admin.get('/admin/v1/brands');
    expect(res.status).toBe(200);
    expect(res.body.data.some((b: { slug: string }) => b.slug === 'acme-corp')).toBe(true);
  });

  it('updates a brand name/description', async () => {
    const created = await admin.post('/admin/v1/brands').send({ name: 'Renameable' });
    const res = await admin
      .patch(`/admin/v1/brands/${created.body.data.publicId}`)
      .send({ name: 'Renamed', description: 'Now with a description' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', description: 'Now with a description' });
  });

  it('404s updating a non-existent brand', async () => {
    const res = await admin.patch('/admin/v1/brands/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('assigns a brand to a product via product update, then rejects deleting an assigned brand', async () => {
    const brand = await admin.post('/admin/v1/brands').send({ name: 'Assignable Brand' });
    const assign = await admin.patch(`/admin/v1/products/${productPublicId}`).send({ brandId: brand.body.data.publicId });
    expect(assign.status).toBe(200);

    const row = await prisma.product.findUniqueOrThrow({ where: { publicId: productPublicId }, select: { brandId: true } });
    expect(row.brandId).not.toBeNull();

    const del = await admin.delete(`/admin/v1/brands/${brand.body.data.publicId}`);
    expect(del.status).toBe(409);
  });

  it('404s assigning a non-existent brand to a product', async () => {
    const res = await admin
      .patch(`/admin/v1/products/${productPublicId}`)
      .send({ brandId: '019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b' });
    expect(res.status).toBe(404);
  });

  it('clears a product brand by sending brandId: null', async () => {
    const brand = await admin.post('/admin/v1/brands').send({ name: 'Clearable Brand' });
    await admin.patch(`/admin/v1/products/${productPublicId}`).send({ brandId: brand.body.data.publicId });

    const clear = await admin.patch(`/admin/v1/products/${productPublicId}`).send({ brandId: null });
    expect(clear.status).toBe(200);
    const row = await prisma.product.findUniqueOrThrow({ where: { publicId: productPublicId }, select: { brandId: true } });
    expect(row.brandId).toBeNull();
  });

  it('deletes an unassigned brand', async () => {
    const brand = await admin.post('/admin/v1/brands').send({ name: 'Deletable Brand' });
    const res = await admin.delete(`/admin/v1/brands/${brand.body.data.publicId}`);
    expect(res.status).toBe(204);
  });

  it('store: lists brands without auth', async () => {
    const res = await admin.get('/store/v1/brands');
    expect(res.status).toBe(200);
    expect(res.body.data.some((b: { slug: string }) => b.slug === 'acme-corp')).toBe(true);
  });

  it('store: gets a brand by slug', async () => {
    const res = await admin.get('/store/v1/brands/acme-corp');
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('acme-corp');
  });

  it('store: 404s getting a brand by an unknown slug', async () => {
    const res = await admin.get('/store/v1/brands/does-not-exist');
    expect(res.status).toBe(404);
  });
});
