import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Product media over HTTP (live DB + live MinIO) — plan/13 Phase J. Proves the
 * direct-to-storage upload flow: request a presigned PUT URL, register the
 * uploaded object as a MediaAsset, attach it to a product's gallery, confirm
 * it shows on the product detail's `media` array, then detach it. Gated on
 * INTEGRATION=1 and requires S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET
 * (a real MinIO, e.g. the `ome-minio-dev` dev container) to be configured.
 */
describe.skipIf(!process.env.INTEGRATION)('media API (live DB + MinIO)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let productPublicId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE product_media, media_asset RESTART IDENTITY CASCADE');

    const set = await prisma.attributeSet.upsert({
      where: { code: 'media-test-set' },
      update: {},
      create: { code: 'media-test-set', name: 'Media Test Set' },
    });
    const product = await prisma.product.create({
      data: { type: 'SIMPLE', sku: `MEDIA-TEST-${Date.now()}`, slug: `media-test-${Date.now()}`, attributeSetId: set.id, status: 'DRAFT', visibility: 'BOTH' },
    });
    productPublicId = product.publicId;
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('requests a presigned upload URL', async () => {
    const res = await admin.post('/admin/v1/media/uploads').send({ filename: 'photo.jpg', mimeType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(typeof res.body.data.uploadUrl).toBe('string');
    expect(res.body.data.uploadUrl).toContain('http');
    expect(res.body.data.storageKey).toMatch(/^products\/.+photo\.jpg$/);
  });

  it('registers an uploaded object as a media asset', async () => {
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'red.png', mimeType: 'image/png' });
    const res = await admin.post('/admin/v1/media').send({
      storageKey: upload.body.data.storageKey,
      mimeType: 'image/png',
      bytes: 1024,
      width: 100,
      height: 100,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ publicId: expect.any(String), mimeType: 'image/png', kind: 'IMAGE' });

    const row = await prisma.mediaAsset.findFirstOrThrow({ where: { storageKey: upload.body.data.storageKey } });
    expect(row.kind).toBe('IMAGE');
  });

  it('attaches a media asset to a product, shown on product detail, then detaches it', async () => {
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'gallery.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 2048 });

    const attach = await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: asset.body.data.publicId });
    expect(attach.status).toBe(201);
    expect(attach.body.data).toMatchObject({ role: 'GALLERY', position: 0, altText: null });
    expect(typeof attach.body.data.url).toBe('string');
    const productMediaId = attach.body.data.productMediaId;

    const detail = await admin.get(`/admin/v1/products/${productPublicId}`);
    expect(detail.body.data.media).toHaveLength(1);
    expect(detail.body.data.media[0]).toMatchObject({ productMediaId, role: 'GALLERY' });

    const detach = await admin.delete(`/admin/v1/products/${productPublicId}/media/${productMediaId}`);
    expect(detach.status).toBe(204);

    const afterDetach = await admin.get(`/admin/v1/products/${productPublicId}`);
    expect(afterDetach.body.data.media).toHaveLength(0);
  });

  it('404s attaching a non-existent media asset', async () => {
    const res = await admin
      .post(`/admin/v1/products/${productPublicId}/media`)
      .send({ mediaPublicId: '019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b' });
    expect(res.status).toBe(404);
  });

  it('404s attaching media to a non-existent product', async () => {
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'x.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    const res = await admin
      .post('/admin/v1/products/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b/media')
      .send({ mediaPublicId: asset.body.data.publicId });
    expect(res.status).toBe(404);
  });

  it('shows a thumbnail URL on the products list once an image is attached', async () => {
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'thumb.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 500 });
    await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: asset.body.data.publicId });

    const all = await admin.get('/admin/v1/products?pageSize=100');
    const found = all.body.data.products.find((p: { publicId: string }) => p.publicId === productPublicId);
    expect(found.thumbnailUrl).toEqual(expect.any(String));
  });

  it('sets a media row as the product thumbnail, enforcing exactly one THUMBNAIL at a time', async () => {
    const uploadA = await admin.post('/admin/v1/media/uploads').send({ filename: 'first.jpg', mimeType: 'image/jpeg' });
    const assetA = await admin.post('/admin/v1/media').send({ storageKey: uploadA.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    const attachA = await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: assetA.body.data.publicId });
    const mediaIdA = attachA.body.data.productMediaId;

    const uploadB = await admin.post('/admin/v1/media/uploads').send({ filename: 'second.jpg', mimeType: 'image/jpeg' });
    const assetB = await admin.post('/admin/v1/media').send({ storageKey: uploadB.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    const attachB = await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: assetB.body.data.publicId });
    const mediaIdB = attachB.body.data.productMediaId;

    // Both start as GALLERY (attach's default role).
    const beforeDetail = await admin.get(`/admin/v1/products/${productPublicId}`);
    expect(beforeDetail.body.data.media.every((m: { role: string }) => m.role === 'GALLERY')).toBe(true);

    const setA = await admin.post(`/admin/v1/products/${productPublicId}/media/${mediaIdA}/set-thumbnail`);
    expect(setA.status).toBe(200);
    expect(setA.body.data).toMatchObject({ productMediaId: mediaIdA, role: 'THUMBNAIL' });

    const afterA = await admin.get(`/admin/v1/products/${productPublicId}`);
    const rolesAfterA = Object.fromEntries(afterA.body.data.media.map((m: { productMediaId: string; role: string }) => [m.productMediaId, m.role]));
    expect(rolesAfterA[mediaIdA]).toBe('THUMBNAIL');
    expect(rolesAfterA[mediaIdB]).toBe('GALLERY');

    // Setting B demotes A back to GALLERY — exactly one THUMBNAIL at a time.
    const setB = await admin.post(`/admin/v1/products/${productPublicId}/media/${mediaIdB}/set-thumbnail`);
    expect(setB.status).toBe(200);
    const afterB = await admin.get(`/admin/v1/products/${productPublicId}`);
    const rolesAfterB = Object.fromEntries(afterB.body.data.media.map((m: { productMediaId: string; role: string }) => [m.productMediaId, m.role]));
    expect(rolesAfterB[mediaIdA]).toBe('GALLERY');
    expect(rolesAfterB[mediaIdB]).toBe('THUMBNAIL');
  });

  it('the products grid thumbnail prefers the designated THUMBNAIL over a lower-position GALLERY image', async () => {
    const uploadFirst = await admin.post('/admin/v1/media/uploads').send({ filename: 'grid-first.jpg', mimeType: 'image/jpeg' });
    const assetFirst = await admin.post('/admin/v1/media').send({ storageKey: uploadFirst.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: assetFirst.body.data.publicId });

    const uploadSecond = await admin.post('/admin/v1/media/uploads').send({ filename: 'grid-second.jpg', mimeType: 'image/jpeg' });
    const assetSecond = await admin.post('/admin/v1/media').send({ storageKey: uploadSecond.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    const attachSecond = await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: assetSecond.body.data.publicId });

    await admin.post(`/admin/v1/products/${productPublicId}/media/${attachSecond.body.data.productMediaId}/set-thumbnail`);

    const all = await admin.get('/admin/v1/products?pageSize=100');
    const found = all.body.data.products.find((p: { publicId: string }) => p.publicId === productPublicId);
    expect(found.thumbnailUrl).toContain(uploadSecond.body.data.storageKey);
  });

  it('404s setting a thumbnail on a media row that belongs to a different product', async () => {
    const otherProduct = await prisma.product.create({
      data: { type: 'SIMPLE', sku: `MEDIA-TEST-OTHER-${Date.now()}`, slug: `media-test-other-${Date.now()}`, attributeSetId: (await prisma.attributeSet.findFirstOrThrow({ where: { code: 'media-test-set' } })).id, status: 'DRAFT', visibility: 'BOTH' },
    });
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'mismatched.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 100 });
    const attach = await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: asset.body.data.publicId });

    const res = await admin.post(`/admin/v1/products/${otherProduct.publicId}/media/${attach.body.data.productMediaId}/set-thumbnail`);
    expect(res.status).toBe(404);
  });
});
