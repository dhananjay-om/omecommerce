import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * The full storefront PDP over HTTP (live DB + MinIO) — plan/14 Phase 0c.
 * `GET /store/v1/products/:publicId` used to return attributes only; this
 * proves the merged response now also carries price, stock, media, variants,
 * categoryIds, and brandSlug. Gated on INTEGRATION=1 and requires
 * S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET (e.g. ome-minio-dev).
 */
describe.skipIf(!process.env.INTEGRATION)('store product detail API (live DB + MinIO)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let storeViewId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE product_media, media_asset, product_category, category RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe('TRUNCATE stock_item, product RESTART IDENTITY CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE brand RESTART IDENTITY CASCADE');

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
    storeViewId = sv.id.toString();
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns price, stock, media, variants, categoryIds, and brandSlug on the storefront PDP', async () => {
    const set = await prisma.attributeSet.upsert({
      where: { code: 'pdp-test-set' },
      update: {},
      create: { code: 'pdp-test-set', name: 'PDP Test Set' },
    });

    const brand = await admin.post('/admin/v1/brands').send({ name: 'PDP Test Brand' });
    const category = await admin.post('/admin/v1/categories').send({ nameDefault: 'PDP Test Category' });

    const product = await admin.post('/admin/v1/products').send({
      type: 'SIMPLE',
      sku: `PDP-TEST-${Date.now()}`,
      attributeSetId: set.id.toString(),
      status: 'ACTIVE',
      nameDefault: 'PDP Test Product',
    });
    const productPublicId = product.body.data.publicId as string;

    await admin.patch(`/admin/v1/products/${productPublicId}`).send({ brandId: brand.body.data.publicId });
    await admin.put(`/admin/v1/products/${productPublicId}/categories`).send({ categoryIds: [category.body.data.publicId] });

    const variants = await admin.get(`/admin/v1/products/${productPublicId}/variants`);
    const variantPublicId = variants.body.data[0].publicId as string;

    const priceList = await admin.post('/admin/v1/price-lists').send({ code: `PDP-PL-${Date.now()}`, name: 'PDP', currency: 'USD', priority: 0 });
    await admin.put(`/admin/v1/price-lists/${priceList.body.data.code}/prices`).send({ variantId: variantPublicId, price: '49.99' });

    const warehouse = await admin.post('/admin/v1/warehouses').send({ code: `PDP-WH-${Date.now()}`, name: 'PDP Warehouse' });
    await admin
      .post('/admin/v1/inventory/adjustments')
      .send({ variantId: variantPublicId, warehouseCode: warehouse.body.data.code, delta: 5, reason: 'PURCHASE' });

    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'pdp.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 1024 });
    await admin.post(`/admin/v1/products/${productPublicId}/media`).send({ mediaPublicId: asset.body.data.publicId });

    const res = await admin.get(`/store/v1/products/${productPublicId}?storeViewId=${storeViewId}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.data.price)).toBe(49.99);
    expect(res.body.data.inStock).toBe(true);
    expect(res.body.data.brandSlug).toBe(brand.body.data.slug);
    expect(res.body.data.categoryIds).toEqual([category.body.data.publicId]);
    expect(res.body.data.media).toHaveLength(1);
    expect(typeof res.body.data.media[0].url).toBe('string');
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0]).toMatchObject({ publicId: variantPublicId, inStock: true });
    expect(Number(res.body.data.variants[0].price)).toBe(49.99);
  });

  it('returns null price/false inStock/empty media+categories/null brandSlug for a bare product with no variant-level data', async () => {
    const set = await prisma.attributeSet.upsert({
      where: { code: 'pdp-bare-set' },
      update: {},
      create: { code: 'pdp-bare-set', name: 'PDP Bare Set' },
    });
    const product = await admin.post('/admin/v1/products').send({
      type: 'SIMPLE',
      sku: `PDP-BARE-${Date.now()}`,
      attributeSetId: set.id.toString(),
      status: 'ACTIVE',
    });
    const productPublicId = product.body.data.publicId as string;

    const res = await admin.get(`/store/v1/products/${productPublicId}?storeViewId=${storeViewId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBeNull();
    expect(res.body.data.inStock).toBe(false);
    expect(res.body.data.media).toEqual([]);
    expect(res.body.data.categoryIds).toEqual([]);
    expect(res.body.data.brandSlug).toBeNull();
    expect(res.body.data.variants).toHaveLength(1);
  });

  it('returns each variant\'s axis values (Size/Color) for a CONFIGURABLE product\'s storefront PDP', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: `pdp-config-set-${Date.now()}`, name: 'PDP Config Set' });
    const setId = set.body.data.id as string;
    const group = await admin.post(`/admin/v1/attribute-sets/${setId}/groups`).send({ name: 'Options' });
    const groupId = group.body.data.id as string;

    const size = await admin.post('/admin/v1/attributes').send({
      code: `pdp-size-${Date.now()}`,
      label: 'Size',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
      isVariantForming: true,
      options: [{ value: 'S', label: 'Small' }, { value: 'M', label: 'Medium' }],
    });
    await admin.post(`/admin/v1/attribute-sets/${setId}/attributes`).send({ groupId, attributeCode: size.body.data.code });

    const product = await admin.post('/admin/v1/products').send({
      type: 'CONFIGURABLE',
      sku: `PDP-CONFIG-${Date.now()}`,
      attributeSetId: setId,
      status: 'ACTIVE',
    });
    const productPublicId = product.body.data.publicId as string;

    const detail = await admin.get(`/admin/v1/attribute-sets/${setId}`);
    const sizeOptionIds = (detail.body.data.groups[0].attributes[0].options as Array<{ id: string }>).map((o) => o.id);

    const gen = await admin.post(`/admin/v1/products/${productPublicId}/variants/generate`).send({
      axes: [{ attributeCode: size.body.data.code, optionIds: sizeOptionIds }],
    });
    expect(gen.body.data.created).toBe(2);

    const res = await admin.get(`/store/v1/products/${productPublicId}?storeViewId=${storeViewId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(2);
    for (const variant of res.body.data.variants) {
      expect(variant.axisValues).toHaveLength(1);
      expect(variant.axisValues[0]).toMatchObject({ attributeCode: size.body.data.code, attributeLabel: 'Size' });
      expect(['Small', 'Medium']).toContain(variant.axisValues[0].optionLabel);
    }
  });

  it('404s getting the storefront PDP for a non-existent product', async () => {
    const res = await admin.get(`/store/v1/products/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b?storeViewId=${storeViewId}`);
    expect(res.status).toBe(404);
  });
});
