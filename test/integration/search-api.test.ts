import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getOpenSearchClient } from '../../src/shared/infrastructure/search/opensearch-client.js';
import { PRODUCT_INDEX } from '../../src/shared/infrastructure/search/index-mapping.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Search over HTTP (live DB + OpenSearch). Proves: full-text search, exact-match
 * faceting (brand/ram), facet counts, price sort, store-view scoping,
 * availability filtering, and primary-image URL resolution. Reindexing is
 * triggered synchronously via
 * POST /admin/v1/search/reindex rather than waiting on the BullMQ outbox relay
 * (no workers run in the test process — see src/workers/index.ts's doc
 * comment). Gated on INTEGRATION=1; the image-resolution test also requires
 * S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET (a real MinIO, e.g. the
 * `ome-minio-dev` dev container), same as media-api.test.ts.
 */
describe.skipIf(!process.env.INTEGRATION)('search API (live DB + OpenSearch)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;
  let attributeSetId = '';
  let storeViewId = '';

  async function createProduct(sku: string, name: string, brand: string, ram: number, price: string): Promise<string> {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE', nameDefault: name });
    const publicId = created.body.data.publicId as string;
    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'search-brand', scope: 'GLOBAL', value: brand });
    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'search-ram', scope: 'GLOBAL', value: ram });
    await admin.post('/admin/v1/price-lists').send({ code: `SEARCH-PL-${sku}`, name: sku, currency: 'USD', priority: 0 });
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    await admin.put(`/admin/v1/price-lists/SEARCH-PL-${sku}/prices`).send({ variantId: variant.publicId, price });
    return publicId;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE price_tier, product_price, price_list, product RESTART IDENTITY CASCADE',
    );
    // Truncating Postgres doesn't touch OpenSearch — stale documents from a prior
    // run (different product publicIds, same names/SKUs) would otherwise leak into
    // full-text search results when this file runs alongside the rest of the suite.
    await getOpenSearchClient().indices.delete({ index: PRODUCT_INDEX }, { ignore: [404] });
    admin = adminRequest(app, await getAdminToken(app));
    const set = await prisma.attributeSet.upsert({
      where: { code: 'search-test-set' },
      update: {},
      create: { code: 'search-test-set', name: 'Search Test Set' },
    });
    attributeSetId = set.id.toString();
    await prisma.attribute.upsert({
      where: { code: 'search-brand' },
      update: {},
      create: { code: 'search-brand', label: 'Brand', dataType: 'TEXT', inputType: 'TEXT', isFilterable: true, usedInLayeredNav: true },
    });
    await prisma.attribute.upsert({
      where: { code: 'search-ram' },
      update: {},
      create: { code: 'search-ram', label: 'RAM', dataType: 'NUMBER', inputType: 'NUMBER', isFilterable: true, usedInLayeredNav: true },
    });
    const sv = await prisma.storeView.findFirstOrThrow();
    storeViewId = sv.id.toString();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('indexes products and finds them via full-text search, scoped to the store view', async () => {
    await createProduct('SEARCH-SKU-A', 'Alpha Widget', 'Acme', 16, '20.00');
    await createProduct('SEARCH-SKU-B', 'Beta Widget', 'Acme', 32, '30.00');
    await createProduct('SEARCH-SKU-C', 'Gizmo Thing', 'OtherBrand', 8, '5.00');

    const reindex = await admin.post('/admin/v1/search/reindex');
    expect(reindex.status).toBe(200);
    expect(reindex.body.data.indexed).toBeGreaterThanOrEqual(3);

    const widgetSearch = await request(app).get('/store/v1/search').query({ storeViewId, q: 'Widget' });
    expect(widgetSearch.status).toBe(200);
    const skus = widgetSearch.body.data.hits.map((h: { sku: string }) => h.sku).sort();
    expect(skus).toEqual(['SEARCH-SKU-A', 'SEARCH-SKU-B']);
  });

  it('facets by exact-match attribute value and reports counts', async () => {
    const res = await request(app).get('/store/v1/search').query({ storeViewId, q: 'Widget' });
    expect(res.body.data.facets['search-brand']).toEqual([{ value: 'Acme', count: 2 }]);
    const ramFacet = res.body.data.facets['search-ram'].sort((a: { value: string }, b: { value: string }) => a.value.localeCompare(b.value));
    expect(ramFacet).toEqual([
      { value: '16', count: 1 },
      { value: '32', count: 1 },
    ]);
  });

  it('filters by a facet value', async () => {
    // Bracket-notation query params are passed as a literal path string (not via
    // .query()) so we don't depend on how supertest/qs would encode an object
    // key that itself contains brackets — this is the unambiguous form.
    const res = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&filter[search-ram]=16`);
    expect(res.status).toBe(200);
    expect(res.body.data.hits).toHaveLength(1);
    expect(res.body.data.hits[0].sku).toBe('SEARCH-SKU-A');
  });

  it('filters by category membership via the reserved __category facet', async () => {
    const category = await admin.post('/admin/v1/categories').send({ nameDefault: 'Search Test Category' });
    const categoryPublicId = category.body.data.publicId as string;
    const publicId = await createProduct('SEARCH-SKU-CAT', 'Categorized Widget', 'Acme', 16, '25.00');
    await admin.put(`/admin/v1/products/${publicId}/categories`).send({ categoryIds: [categoryPublicId] });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&filter[__category]=${categoryPublicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hits.map((h: { sku: string }) => h.sku)).toEqual(['SEARCH-SKU-CAT']);
  });

  it('filtering by a parent category also surfaces products assigned only to a child category', async () => {
    const parent = await admin.post('/admin/v1/categories').send({ nameDefault: 'Search Test Parent' });
    const parentPublicId = parent.body.data.publicId as string;
    const child = await admin.post('/admin/v1/categories').send({ nameDefault: 'Search Test Child', parentId: parentPublicId });
    const childPublicId = child.body.data.publicId as string;
    const publicId = await createProduct('SEARCH-SKU-CHILDCAT', 'Child Categorized Widget', 'Acme', 16, '25.00');
    await admin.put(`/admin/v1/products/${publicId}/categories`).send({ categoryIds: [childPublicId] });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&filter[__category]=${parentPublicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hits.map((h: { sku: string }) => h.sku)).toEqual(['SEARCH-SKU-CHILDCAT']);
  });

  it('filters by brand via the reserved __brand facet', async () => {
    const brand = await admin.post('/admin/v1/brands').send({ name: 'Search Test Brand' });
    const brandPublicId = brand.body.data.publicId as string;
    const publicId = await createProduct('SEARCH-SKU-BRAND', 'Branded Widget', 'Acme', 16, '22.00');
    await admin.patch(`/admin/v1/products/${publicId}`).send({ brandId: brandPublicId });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&filter[__brand]=${brandPublicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hits.map((h: { sku: string }) => h.sku)).toEqual(['SEARCH-SKU-BRAND']);
  });

  it('resolves the primary image to a fresh presigned URL, and null when no media is attached', async () => {
    const withoutMedia = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&filter[search-ram]=16`);
    expect(withoutMedia.body.data.hits[0].imageUrl).toBeNull();

    const publicId = await createProduct('SEARCH-SKU-IMG', 'Photographed Widget', 'Acme', 8, '30.00');
    const upload = await admin.post('/admin/v1/media/uploads').send({ filename: 'widget.jpg', mimeType: 'image/jpeg' });
    const asset = await admin.post('/admin/v1/media').send({ storageKey: upload.body.data.storageKey, mimeType: 'image/jpeg', bytes: 1024 });
    await admin.post(`/admin/v1/products/${publicId}/media`).send({ mediaPublicId: asset.body.data.publicId });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get(`/store/v1/search?storeViewId=${storeViewId}&q=Photographed`);
    expect(res.body.data.hits).toHaveLength(1);
    expect(res.body.data.hits[0].imageUrl).toContain('http');
    expect(res.body.data.hits[0].imageUrl).toContain(upload.body.data.storageKey);
  });

  it('filters by availability (inStock)', async () => {
    await createProduct('SEARCH-SKU-OOS', 'Out Of Stock Widget', 'Acme', 16, '15.00');
    await createProduct('SEARCH-SKU-INSTOCK', 'In Stock Widget', 'Acme', 16, '15.00');
    await admin.post('/admin/v1/warehouses').send({ code: 'SEARCH-WH', name: 'Search Test Warehouse' });
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'SEARCH-SKU-INSTOCK' } });
    await admin.post('/admin/v1/inventory/adjustments').send({
      variantId: variant.publicId,
      warehouseCode: 'SEARCH-WH',
      delta: 10,
      reason: 'PURCHASE',
    });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get('/store/v1/search').query({ storeViewId, inStock: 'true', q: 'Widget' });
    const skus = res.body.data.hits.map((h: { sku: string }) => h.sku);
    expect(skus).toContain('SEARCH-SKU-INSTOCK');
    expect(skus).not.toContain('SEARCH-SKU-OOS');
  });

  it('filters by a price range (minPrice/maxPrice)', async () => {
    const res = await request(app).get('/store/v1/search').query({ storeViewId, minPrice: 15, maxPrice: 25 });
    expect(res.status).toBe(200);
    const prices = res.body.data.hits.map((h: { priceDisplay: string }) => Number(h.priceDisplay));
    expect(prices.every((p: number) => p >= 15 && p <= 25)).toBe(true);
    expect(prices.length).toBeGreaterThan(0);
  });

  it('sorts by price ascending and descending', async () => {
    const asc = await request(app).get('/store/v1/search').query({ storeViewId, sort: 'price_asc' });
    const ascPrices = asc.body.data.hits.map((h: { priceDisplay: string }) => Number(h.priceDisplay));
    expect(ascPrices).toEqual([...ascPrices].sort((a, b) => a - b));

    const desc = await request(app).get('/store/v1/search').query({ storeViewId, sort: 'price_desc' });
    const descPrices = desc.body.data.hits.map((h: { priceDisplay: string }) => Number(h.priceDisplay));
    expect(descPrices).toEqual([...descPrices].sort((a, b) => b - a));
  });

  it('excludes a product from search once its status is no longer ACTIVE, after reindexing', async () => {
    const publicId = await createProduct('SEARCH-SKU-ARCHIVED', 'Archived Widget', 'Acme', 64, '99.00');
    await prisma.product.update({ where: { publicId }, data: { status: 'ARCHIVED' } });
    await admin.post('/admin/v1/search/reindex');

    const res = await request(app).get('/store/v1/search').query({ storeViewId, q: 'Archived' });
    expect(res.body.data.hits).toHaveLength(0);
  });

  it('rejects an invalid sort value with 422', async () => {
    const res = await request(app).get('/store/v1/search').query({ storeViewId, sort: 'not-a-real-sort' });
    expect(res.status).toBe(422);
  });
});
