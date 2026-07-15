import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';
import { getAdminToken, adminRequest } from '../helpers/auth.js';

/**
 * Attribute-set builder over HTTP (live DB) — plan/04 §2.1. The schema
 * (AttributeSet/AttributeSetGroup/AttributeSetAttribute/Attribute/AttributeOption)
 * already existed from Stage 1; this proves the admin authoring endpoints on top of
 * it. Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('attribute-set builder API (live DB)', () => {
  const app = createApp();
  let admin: ReturnType<typeof adminRequest>;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE attribute_set_attribute, attribute_set_group, attribute_option, attribute, attribute_set RESTART IDENTITY CASCADE',
    );
    admin = adminRequest(app, await getAdminToken(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates an attribute set', async () => {
    const res = await admin.post('/admin/v1/attribute-sets').send({ code: 'laptops', name: 'Laptops' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: expect.any(String), code: 'laptops', name: 'Laptops' });
  });

  it('rejects a duplicate attribute-set code with 409', async () => {
    const res = await admin.post('/admin/v1/attribute-sets').send({ code: 'laptops', name: 'Laptops again' });
    expect(res.status).toBe(409);
  });

  it('creates a group within the set', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'phones', name: 'Phones' });
    const group = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`)
      .send({ name: 'Specifications', sortOrder: 1 });
    expect(group.status).toBe(201);
    expect(group.body.data).toEqual({
      id: expect.any(String),
      attributeSetId: set.body.data.id,
      name: 'Specifications',
      sortOrder: 1,
    });
  });

  it('404s creating a group under a non-existent attribute set', async () => {
    const res = await admin.post('/admin/v1/attribute-sets/999999/groups').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('creates a reusable attribute with inline options', async () => {
    const res = await admin.post('/admin/v1/attributes').send({
      code: 'screen-size',
      label: 'Screen Size',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
      isFilterable: true,
      options: [
        { value: '13', label: '13"' },
        { value: '15', label: '15"' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      code: 'screen-size',
      label: 'Screen Size',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
    });
    const options = await prisma.attributeOption.findMany({ where: { attribute: { code: 'screen-size' } } });
    expect(options.map((o) => o.value).sort()).toEqual(['13', '15']);
  });

  it('rejects a duplicate attribute code with 409', async () => {
    const res = await admin
      .post('/admin/v1/attributes')
      .send({ code: 'screen-size', label: 'Dup', dataType: 'TEXT', inputType: 'TEXT' });
    expect(res.status).toBe(409);
  });

  it('assigns an attribute to a set group, in order', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'tablets', name: 'Tablets' });
    const group = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`)
      .send({ name: 'General' });

    const assign = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'screen-size', sortOrder: 2 });
    expect(assign.status).toBe(204);

    const row = await prisma.attributeSetAttribute.findFirstOrThrow({
      where: { attributeSetId: BigInt(set.body.data.id) },
      include: { attribute: true },
    });
    expect(row.attribute.code).toBe('screen-size');
    expect(row.sortOrder).toBe(2);
  });

  it('rejects assigning the same attribute to a set twice with 409', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'monitors', name: 'Monitors' });
    const group = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`)
      .send({ name: 'General' });
    await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'screen-size' });

    const dup = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'screen-size' });
    expect(dup.status).toBe(409);
  });

  it('404s assigning a non-existent attribute code', async () => {
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'cameras', name: 'Cameras' });
    const group = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`)
      .send({ name: 'General' });
    const res = await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'does-not-exist' });
    expect(res.status).toBe(404);
  });
});
