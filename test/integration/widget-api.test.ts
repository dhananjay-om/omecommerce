import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Placeable content widgets over HTTP (live DB) — Content > Widgets. Proves
 * admin CRUD, per-type config validation (discriminated union), soft-delete,
 * and the storefront's active-only, page+section-filtered, position-ordered
 * read. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('widget API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE widget_instance RESTART IDENTITY CASCADE');
    await prisma.$executeRawUnsafe('TRUNCATE cms_block RESTART IDENTITY CASCADE');
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a widget, defaulting page to "home" and active to true', async () => {
    const res = await admin.post('/admin/v1/widgets').send({ type: 'CATEGORY_GRID', section: 'MIDDLE', config: {} });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ type: 'CATEGORY_GRID', page: 'home', section: 'MIDDLE', isActive: true });
  });

  it('rejects a config shape that does not match the widget type (discriminated union)', async () => {
    const res = await admin.post('/admin/v1/widgets').send({ type: 'CMS_BLOCK', section: 'TOP', config: { limit: 5 } }); // CMS_BLOCK needs { code }, not { limit }
    expect(res.status).toBe(422);
  });

  it('accepts a valid WHY_CHOOSE_US_LIST config with repeatable rows', async () => {
    const res = await admin.post('/admin/v1/widgets').send({
      type: 'WHY_CHOOSE_US_LIST',
      section: 'MIDDLE',
      title: 'Why Shop With Us',
      config: { features: [{ icon: 'truck', title: 'Free Shipping', description: 'On all orders' }] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.config.features).toHaveLength(1);
    expect(res.body.data.title).toBe('Why Shop With Us');
  });

  it('admin: lists widgets for page=home and gets one by publicId', async () => {
    const list = await admin.get('/admin/v1/widgets').query({ page: 'home' });
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);

    const first = list.body.data[0];
    const single = await admin.get(`/admin/v1/widgets/${first.publicId}`);
    expect(single.status).toBe(200);
    expect(single.body.data.publicId).toBe(first.publicId);
  });

  it('updates a widget: section, position, active toggle, and config', async () => {
    const created = await admin.post('/admin/v1/widgets').send({ type: 'BRAND_GRID', section: 'FOOTER', config: {} });
    const res = await admin
      .put(`/admin/v1/widgets/${created.body.data.publicId}`)
      .send({ section: 'MIDDLE', position: 5, isActive: false, config: { limit: 8 } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ section: 'MIDDLE', position: 5, isActive: false, config: { limit: 8 } });
  });

  it('store: lists only active widgets for one page+section, ordered by position', async () => {
    await admin.post('/admin/v1/widgets').send({ type: 'CATEGORY_GRID', section: 'TOP', position: 2, config: {} });
    await admin.post('/admin/v1/widgets').send({ type: 'BRAND_GRID', section: 'TOP', position: 1, title: 'first', config: {} });
    const inactive = await admin.post('/admin/v1/widgets').send({ type: 'CMS_BLOCK', section: 'TOP', position: 0, config: { code: 'whatever' } });
    await admin.put(`/admin/v1/widgets/${inactive.body.data.publicId}`).send({ isActive: false });

    const res = await request(app).get('/store/v1/widgets').query({ page: 'home', section: 'TOP' });
    expect(res.status).toBe(200);
    const types = res.body.data.map((w: { type: string; position: number }) => w.type);
    expect(types).not.toContain('CMS_BLOCK'); // the inactive one
    // Positions ascending.
    const positions = res.body.data.map((w: { position: number }) => w.position);
    expect(positions).toEqual([...positions].sort((a: number, b: number) => a - b));
  });

  it('resolves a CMS_BLOCK widget to the referenced block content on the storefront', async () => {
    await admin.post('/admin/v1/cms/blocks').send({ code: 'widget-test-block', body: '<p>Hello from a widget</p>' });
    const blocks = await admin.get('/admin/v1/cms/blocks');
    const block = blocks.body.data.find((b: { code: string }) => b.code === 'widget-test-block');
    await admin.put(`/admin/v1/cms/blocks/${block.publicId}`).send({ status: 'PUBLISHED' });

    const widget = await admin.post('/admin/v1/widgets').send({ type: 'CMS_BLOCK', section: 'FOOTER', config: { code: 'widget-test-block' } });
    expect(widget.status).toBe(201);

    // The widget list itself just carries the config; resolving to the block's
    // actual body is the storefront WidgetRenderer's job (fetches
    // /store/v1/content/blocks/:code separately) — confirm that endpoint
    // resolves correctly for the referenced code as a proxy for that wiring.
    const blockRead = await request(app).get('/store/v1/content/blocks/widget-test-block').query({ storeViewId: '1' });
    expect(blockRead.status).toBe(200);
    expect(blockRead.body.data.body).toBe('<p>Hello from a widget</p>');
  });

  it('accepts a CATEGORY_GRID config with a curated, ordered categoryIds list', async () => {
    const cat = await admin.post('/admin/v1/categories').send({ nameDefault: 'Widget Test Category' });
    const res = await admin.post('/admin/v1/widgets').send({
      type: 'CATEGORY_GRID',
      section: 'MIDDLE',
      config: { categoryIds: [cat.body.data.publicId], limit: 5 },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.config.categoryIds).toEqual([cat.body.data.publicId]);
  });

  it('rejects a CATEGORY_GRID config with a malformed categoryIds entry', async () => {
    const res = await admin.post('/admin/v1/widgets').send({
      type: 'CATEGORY_GRID',
      section: 'MIDDLE',
      config: { categoryIds: ['not-a-uuid'] },
    });
    expect(res.status).toBe(422);
  });

  it('accepts a BRAND_GRID config with a curated, ordered brandIds list', async () => {
    const brand = await admin.post('/admin/v1/brands').send({ name: 'Widget Test Brand' });
    const res = await admin.post('/admin/v1/widgets').send({
      type: 'BRAND_GRID',
      section: 'MIDDLE',
      config: { brandIds: [brand.body.data.publicId] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.config.brandIds).toEqual([brand.body.data.publicId]);
  });

  it('rejects a BRAND_GRID config with a malformed brandIds entry', async () => {
    const res = await admin.post('/admin/v1/widgets').send({
      type: 'BRAND_GRID',
      section: 'MIDDLE',
      config: { brandIds: ['not-a-uuid'] },
    });
    expect(res.status).toBe(422);
  });

  it('admin: soft-deletes a widget — disappears from admin list and storefront read', async () => {
    const created = await admin.post('/admin/v1/widgets').send({ type: 'BRAND_GRID', section: 'FOOTER', position: 99, config: {} });
    const del = await admin.delete(`/admin/v1/widgets/${created.body.data.publicId}`);
    expect(del.status).toBe(204);

    const getDeleted = await admin.get(`/admin/v1/widgets/${created.body.data.publicId}`);
    expect(getDeleted.status).toBe(404);

    const store = await request(app).get('/store/v1/widgets').query({ page: 'home', section: 'FOOTER' });
    expect(store.body.data.some((w: { position: number }) => w.position === 99)).toBe(false);
  });

  it('404s deleting a non-existent widget', async () => {
    const res = await admin.delete('/admin/v1/widgets/019f6a8d-be4e-7fb9-8d0a-95aa834a0c8b');
    expect(res.status).toBe(404);
  });

  it('401s creating a widget with no admin auth', async () => {
    const res = await request(app).post('/admin/v1/widgets').send({ type: 'BRAND_GRID', section: 'TOP', config: {} });
    expect(res.status).toBe(401);
  });
});
