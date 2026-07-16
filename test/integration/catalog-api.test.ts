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

  it('lists products with pagination, status filter, and search (admin browse — was previously undiscoverable via any API)', async () => {
    const all = await admin.get('/admin/v1/products');
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBeGreaterThanOrEqual(4);
    expect(all.body.data.page).toBe(1);
    expect(all.body.data.pageSize).toBe(20);

    const firstPage = await admin.get('/admin/v1/products').query({ pageSize: 2, page: 1 });
    expect(firstPage.body.data.products).toHaveLength(2);

    const active = await admin.get('/admin/v1/products').query({ status: 'ACTIVE' });
    expect(active.body.data.products.every((p: { status: string }) => p.status === 'ACTIVE')).toBe(true);
    expect(active.body.data.products.some((p: { sku: string }) => p.sku === 'API-SKU-1')).toBe(true);

    const searched = await admin.get('/admin/v1/products').query({ search: 'Phone A' });
    expect(searched.body.data.products).toHaveLength(1);
    expect(searched.body.data.products[0].sku).toBe('API-SKU-1');
  });

  it('lists products filtered by type/attribute set, sorted, with quantity/salable-quantity columns', async () => {
    const otherSet = await admin.post('/admin/v1/attribute-sets').send({ code: 'list-filter-set', name: 'List Filter Set' });
    await admin.post('/admin/v1/products').send({ type: 'DIGITAL', sku: 'API-SKU-LIST-DIGITAL', attributeSetId: otherSet.body.data.id });

    const byType = await admin.get('/admin/v1/products').query({ type: 'DIGITAL' });
    expect(byType.body.data.products.every((p: { type: string }) => p.type === 'DIGITAL')).toBe(true);
    expect(byType.body.data.products.some((p: { sku: string }) => p.sku === 'API-SKU-LIST-DIGITAL')).toBe(true);

    const bySet = await admin.get('/admin/v1/products').query({ attributeSetId: otherSet.body.data.id });
    expect(bySet.body.data.products).toHaveLength(1);
    expect(bySet.body.data.products[0].sku).toBe('API-SKU-LIST-DIGITAL');

    const sortedAsc = await admin.get('/admin/v1/products').query({ sortBy: 'sku', sortDir: 'asc', pageSize: 100 });
    const skus = sortedAsc.body.data.products.map((p: { sku: string }) => p.sku);
    expect(skus).toEqual([...skus].sort());

    // Quantity/salableQuantity: create a warehouse + variant, adjust stock, confirm the grid reflects it.
    await admin.post('/admin/v1/warehouses').send({ code: 'LIST-WH', name: 'List Warehouse' });
    const withStock = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'API-SKU-LIST-STOCK', attributeSetId });
    const variantId = (await admin.get(`/admin/v1/products/${withStock.body.data.publicId}/variants`)).body.data[0].publicId;
    await admin.post('/admin/v1/inventory/adjustments').send({ variantId, warehouseCode: 'LIST-WH', delta: 25, reason: 'PURCHASE' });

    const withQty = await admin.get('/admin/v1/products').query({ search: 'API-SKU-LIST-STOCK' });
    expect(withQty.body.data.products[0]).toMatchObject({ quantity: 25, salableQuantity: 25 });

    // A product with no stock at all still gets quantity 0, not omitted.
    const zeroQty = await admin.get('/admin/v1/products').query({ search: 'API-SKU-LIST-DIGITAL' });
    expect(zeroQty.body.data.products[0]).toMatchObject({ quantity: 0, salableQuantity: 0 });
  });

  it('gets a product\'s admin detail: raw fields, variants, and GLOBAL-scope attributes', async () => {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'API-SKU-5', attributeSetId, nameDefault: 'Detail Check', status: 'ACTIVE' });
    const publicId = created.body.data.publicId as string;
    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'ram', scope: 'GLOBAL', value: 32 });
    // A STORE_VIEW override should NOT show up in the admin detail (GLOBAL-only for this pass).
    await admin.put(`/admin/v1/products/${publicId}/attributes`).send({ attributeCode: 'ram', scope: 'STORE_VIEW', storeViewId, value: 64 });

    const detail = await admin.get(`/admin/v1/products/${publicId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ publicId, sku: 'API-SKU-5', name: 'Detail Check', status: 'ACTIVE', attributeSetId });
    expect(detail.body.data.variants).toHaveLength(1);
    expect(detail.body.data.variants[0].sku).toBe('API-SKU-5');
    expect(detail.body.data.attributes.ram).toBe(32);
  });

  it('404s getting detail for an unknown product', async () => {
    const res = await admin.get('/admin/v1/products/00000000-0000-7000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('lists attribute sets (admin browse — populates the create-product picker)', async () => {
    const res = await admin.get('/admin/v1/attribute-sets');
    expect(res.status).toBe(200);
    expect(res.body.data.some((s: { code: string }) => s.code === 'electronics')).toBe(true);
    const electronics = res.body.data.find((s: { code: string }) => s.code === 'electronics');
    expect(electronics).toMatchObject({ code: 'electronics', name: 'Electronics', isDefault: true });
  });

  it('updates a product\'s core fields (name/status/visibility/weight/attribute set)', async () => {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'API-SKU-UPDATE-1', attributeSetId, status: 'DRAFT' });
    const publicId = created.body.data.publicId as string;

    const otherSet = await admin.post('/admin/v1/attribute-sets').send({ code: 'update-test-set', name: 'Update Test Set' });

    const updated = await admin.patch(`/admin/v1/products/${publicId}`).send({
      nameDefault: 'Renamed Product',
      status: 'ACTIVE',
      visibility: 'CATALOG',
      weight: '2.5',
      attributeSetId: otherSet.body.data.id,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      publicId,
      name: 'Renamed Product',
      status: 'ACTIVE',
      visibility: 'CATALOG',
      weight: '2.5',
    });

    const detail = await admin.get(`/admin/v1/products/${publicId}`);
    expect(detail.body.data).toMatchObject({
      name: 'Renamed Product',
      status: 'ACTIVE',
      attributeSetId: otherSet.body.data.id,
    });

    // SKU and type were never sent — confirm they're untouched (patch semantics).
    expect(detail.body.data.sku).toBe('API-SKU-UPDATE-1');
    expect(detail.body.data.type).toBe('SIMPLE');
  });

  it('partially updates a product without touching omitted fields', async () => {
    const created = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'API-SKU-UPDATE-2', attributeSetId, nameDefault: 'Original Name', status: 'DRAFT' });
    const publicId = created.body.data.publicId as string;

    const updated = await admin.patch(`/admin/v1/products/${publicId}`).send({ status: 'ACTIVE' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('ACTIVE');
    expect(updated.body.data.name).toBe('Original Name');
  });

  it('404s updating an unknown product', async () => {
    const res = await admin.patch('/admin/v1/products/00000000-0000-7000-8000-000000000000').send({ status: 'ACTIVE' });
    expect(res.status).toBe(404);
  });

  it('gets an attribute set\'s detail: groups, assigned attributes, and options', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'detail-test-set', name: 'Detail Test Set' });
    const setId = set.body.data.id as string;
    const group = await admin.post(`/admin/v1/attribute-sets/${setId}/groups`).send({ name: 'Specs', sortOrder: 1 });
    const groupId = group.body.data.id as string;

    await admin.post('/admin/v1/attributes').send({
      code: 'color-detail-test',
      label: 'Color',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });
    await admin
      .post(`/admin/v1/attribute-sets/${setId}/attributes`)
      .send({ groupId, attributeCode: 'color-detail-test', sortOrder: 1 });

    const detail = await admin.get(`/admin/v1/attribute-sets/${setId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: setId, code: 'detail-test-set', name: 'Detail Test Set' });
    expect(detail.body.data.groups).toHaveLength(1);
    expect(detail.body.data.groups[0]).toMatchObject({ name: 'Specs', sortOrder: 1 });
    expect(detail.body.data.groups[0].attributes).toHaveLength(1);
    expect(detail.body.data.groups[0].attributes[0]).toMatchObject({
      code: 'color-detail-test',
      label: 'Color',
      dataType: 'SELECT',
    });
    expect(detail.body.data.groups[0].attributes[0].options).toEqual([
      { id: expect.any(String), value: 'red', label: 'Red', swatch: null, sortOrder: 0 },
      { id: expect.any(String), value: 'blue', label: 'Blue', swatch: null, sortOrder: 0 },
    ]);
  });

  it('404s getting detail for an unknown attribute set', async () => {
    const res = await admin.get('/admin/v1/attribute-sets/999999');
    expect(res.status).toBe(404);
  });

  it('bulk-assigns several attribute values in one atomic write (one outbox event, not N)', async () => {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-BULK-1', attributeSetId });
    const publicId = created.body.data.publicId as string;

    await admin.post('/admin/v1/attributes').send({ code: 'bulk-test-note', label: 'Note', dataType: 'TEXT', inputType: 'TEXT' });

    const bulk = await admin.put(`/admin/v1/products/${publicId}/attributes/bulk`).send({
      values: [
        { attributeCode: 'ram', value: 16 },
        { attributeCode: 'bulk-test-note', value: 'saved together' },
      ],
    });
    expect(bulk.status).toBe(204);

    const detail = await admin.get(`/admin/v1/products/${publicId}`);
    expect(detail.body.data.attributes.ram).toBe(16);
    expect(detail.body.data.attributes['bulk-test-note']).toBe('saved together');
  });

  it('rolls back the whole bulk write if any single value is invalid (atomic, not partial)', async () => {
    const created = await admin.post('/admin/v1/products').send({ type: 'SIMPLE', sku: 'API-SKU-BULK-2', attributeSetId });
    const publicId = created.body.data.publicId as string;

    const bulk = await admin.put(`/admin/v1/products/${publicId}/attributes/bulk`).send({
      values: [
        { attributeCode: 'ram', value: 8 },
        { attributeCode: 'ram', value: 'not-a-number' },
      ],
    });
    expect(bulk.status).toBe(422);

    const detail = await admin.get(`/admin/v1/products/${publicId}`);
    expect(detail.body.data.attributes.ram).toBeUndefined();
  });

  it('404s bulk-assigning attributes for an unknown product', async () => {
    const res = await admin
      .put('/admin/v1/products/00000000-0000-7000-8000-000000000000/attributes/bulk')
      .send({ values: [{ attributeCode: 'ram', value: 1 }] });
    expect(res.status).toBe(404);
  });
});
