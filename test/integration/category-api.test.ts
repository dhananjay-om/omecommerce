import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Category tree admin API over HTTP (live DB) — plan/13 Phase K. The ltree
 * path/closure-table maintenance is already handled by DB triggers and the
 * `category_reparent()` stored procedure (prisma/sql/0001_foundation_raw.sql
 * §11-12); this proves the admin CRUD + reparent + product-assignment layer on
 * top of it. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('category API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let productPublicId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE category, category_closure, product_category RESTART IDENTITY CASCADE');

    const set = await prisma.attributeSet.upsert({
      where: { code: 'cat-test-set' },
      update: {},
      create: { code: 'cat-test-set', name: 'Category Test Set' },
    });
    const product = await prisma.product.create({
      data: { type: 'SIMPLE', sku: `CAT-TEST-${Date.now()}`, slug: `cat-test-${Date.now()}`, attributeSetId: set.id, status: 'DRAFT', visibility: 'BOTH' },
    });
    productPublicId = product.publicId;
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a root category with an auto-generated slug', async () => {
    const res = await admin.post('/admin/v1/categories').send({ nameDefault: 'Electronics' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      publicId: expect.any(String),
      parentId: null,
      slug: 'electronics',
      type: 'MANUAL',
      sortMode: 'POSITION',
      position: 0,
      nameDefault: 'Electronics',
      description: null,
      imageMediaKey: null,
      imageUrl: null,
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      includeInMenu: true,
      createdAt: expect.any(String),
    });
  });

  it('disambiguates a slug collision with a numeric suffix', async () => {
    const res = await admin.post('/admin/v1/categories').send({ nameDefault: 'Electronics' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('electronics-2');
  });

  it('creates a child category and lists the flat tree', async () => {
    const parent = await admin.post('/admin/v1/categories').send({ nameDefault: 'Computers' });
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'Laptops', parentId: parent.body.data.publicId });
    expect(child.status).toBe(201);
    expect(child.body.data.parentId).toBe(parent.body.data.publicId);

    const list = await admin.get('/admin/v1/categories');
    expect(list.status).toBe(200);
    const laptops = list.body.data.find((c: { publicId: string }) => c.publicId === child.body.data.publicId);
    expect(laptops.parentId).toBe(parent.body.data.publicId);
  });

  it('404s creating a child under a non-existent parent', async () => {
    const res = await admin.post('/admin/v1/categories').send({ nameDefault: 'Ghost', parentId: '019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b' });
    expect(res.status).toBe(404);
  });

  it('updates a category name/sortMode/position', async () => {
    const created = await admin.post('/admin/v1/categories').send({ nameDefault: 'Phones' });
    const res = await admin
      .patch(`/admin/v1/categories/${created.body.data.publicId}`)
      .send({ nameDefault: 'Smartphones', sortMode: 'NAME', position: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nameDefault: 'Smartphones', sortMode: 'NAME', position: 5 });
  });

  it('updates description/image/SEO fields and the includeInMenu toggle', async () => {
    const created = await admin.post('/admin/v1/categories').send({ nameDefault: 'Shoes' });
    const res = await admin.patch(`/admin/v1/categories/${created.body.data.publicId}`).send({
      description: 'Great shoes.',
      imageMediaKey: 'category-images/shoes-test.jpg',
      metaTitle: 'Shoes | OMEShop',
      metaDescription: 'Shop our shoes.',
      metaKeywords: 'shoes, footwear',
      includeInMenu: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      description: 'Great shoes.',
      imageMediaKey: 'category-images/shoes-test.jpg',
      metaTitle: 'Shoes | OMEShop',
      metaDescription: 'Shop our shoes.',
      metaKeywords: 'shoes, footwear',
      includeInMenu: false,
    });
    expect(typeof res.body.data.imageUrl).toBe('string');
  });

  it('treats whitespace-only SEO fields as not provided (blankToUndefined)', async () => {
    const created = await admin.post('/admin/v1/categories').send({ nameDefault: 'Bags' });
    const res = await admin.patch(`/admin/v1/categories/${created.body.data.publicId}`).send({ metaTitle: '   ' });
    expect(res.status).toBe(200);
    expect(res.body.data.metaTitle).toBeNull();
  });

  it('mints a presigned upload URL for a category image', async () => {
    const created = await admin.post('/admin/v1/categories').send({ nameDefault: 'Watches' });
    const res = await admin
      .post(`/admin/v1/categories/${created.body.data.publicId}/image-upload-url`)
      .send({ filename: 'watch.jpg', mimeType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.data.uploadUrl).toEqual(expect.any(String));
    expect(res.body.data.imageMediaKey).toContain('category-images/watches-');
  });

  it('404s minting an image upload URL for a non-existent category', async () => {
    const res = await admin
      .post('/admin/v1/categories/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b/image-upload-url')
      .send({ filename: 'x.jpg', mimeType: 'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('reparents a category to a new parent', async () => {
    const root1 = await admin.post('/admin/v1/categories').send({ nameDefault: 'Root One' });
    const root2 = await admin.post('/admin/v1/categories').send({ nameDefault: 'Root Two' });
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'Movable', parentId: root1.body.data.publicId });

    const res = await admin
      .put(`/admin/v1/categories/${child.body.data.publicId}/parent`)
      .send({ newParentId: root2.body.data.publicId });
    expect(res.status).toBe(200);
    expect(res.body.data.parentId).toBe(root2.body.data.publicId);
  });

  it('reparents a category to root (newParentId: null)', async () => {
    const root = await admin.post('/admin/v1/categories').send({ nameDefault: 'Root Three' });
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'ToRoot', parentId: root.body.data.publicId });

    const res = await admin.put(`/admin/v1/categories/${child.body.data.publicId}/parent`).send({ newParentId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.parentId).toBeNull();
  });

  it('rejects reparenting a category under its own descendant (cycle guard)', async () => {
    const parent = await admin.post('/admin/v1/categories').send({ nameDefault: 'CycleParent' });
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'CycleChild', parentId: parent.body.data.publicId });

    const res = await admin
      .put(`/admin/v1/categories/${parent.body.data.publicId}/parent`)
      .send({ newParentId: child.body.data.publicId });
    expect(res.status).toBe(409);
  });

  it('rejects deleting a category that has children', async () => {
    const parent = await admin.post('/admin/v1/categories').send({ nameDefault: 'HasChild' });
    await admin.post('/admin/v1/categories').send({ nameDefault: 'Child', parentId: parent.body.data.publicId });

    const res = await admin.delete(`/admin/v1/categories/${parent.body.data.publicId}`);
    expect(res.status).toBe(409);
  });

  it('assigns categories to a product, shown on the product detail, then rejects deleting an assigned category', async () => {
    const cat = await admin.post('/admin/v1/categories').send({ nameDefault: 'Assignable' });
    const assign = await admin
      .put(`/admin/v1/products/${productPublicId}/categories`)
      .send({ categoryIds: [cat.body.data.publicId] });
    expect(assign.status).toBe(204);

    const detail = await admin.get(`/admin/v1/products/${productPublicId}`);
    expect(detail.body.data.categoryIds).toEqual([cat.body.data.publicId]);

    const del = await admin.delete(`/admin/v1/categories/${cat.body.data.publicId}`);
    expect(del.status).toBe(409);
  });

  it('deletes a leaf category with no children/products', async () => {
    const cat = await admin.post('/admin/v1/categories').send({ nameDefault: 'Deletable' });
    const res = await admin.delete(`/admin/v1/categories/${cat.body.data.publicId}`);
    expect(res.status).toBe(204);
  });

  it('store: lists categories without auth', async () => {
    const res = await admin.get('/store/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { slug: string }) => c.slug === 'electronics')).toBe(true);
  });

  it('store: gets a category by slug with a root-first breadcrumb', async () => {
    const grandparent = await admin.post('/admin/v1/categories').send({ nameDefault: 'Store Root' });
    const parent = await admin
      .post('/admin/v1/categories')
      .send({ nameDefault: 'Store Mid', parentId: grandparent.body.data.publicId });
    const child = await admin
      .post('/admin/v1/categories')
      .send({ nameDefault: 'Store Leaf', parentId: parent.body.data.publicId });

    const res = await admin.get(`/store/v1/categories/${child.body.data.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.category.slug).toBe(child.body.data.slug);
    expect(res.body.data.breadcrumb.map((c: { slug: string }) => c.slug)).toEqual(['store-root', 'store-mid']);
  });

  it('store: 404s getting a category by an unknown slug', async () => {
    const res = await admin.get('/store/v1/categories/does-not-exist');
    expect(res.status).toBe(404);
  });
});
