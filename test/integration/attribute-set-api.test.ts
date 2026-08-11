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
    expect(res.body.data).toEqual({ id: expect.any(String), code: 'laptops', name: 'Laptops', isDefault: false });
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
      isRequired: false,
      isFilterable: true,
      isSearchable: false,
      isComparable: false,
      isSortable: false,
      isVisiblePdp: true,
      isVisiblePlp: false,
      usedInSearch: false,
      usedInLayeredNav: false,
      isVariantForming: false,
    });
    const options = await prisma.attributeOption.findMany({ where: { attribute: { code: 'screen-size' } } });
    expect(options.map((o) => o.value).sort()).toEqual(['13', '15']);
  });

  it('lists all reusable attributes (admin browse — populates the "assign existing attribute" picker)', async () => {
    const res = await admin.get('/admin/v1/attributes');
    expect(res.status).toBe(200);
    expect(
      res.body.data.find((a: { code: string }) => a.code === 'screen-size'),
    ).toEqual({
      id: expect.any(String),
      code: 'screen-size',
      label: 'Screen Size',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
      isRequired: false,
      isFilterable: true,
      isSearchable: false,
      isComparable: false,
      isSortable: false,
      isVisiblePdp: true,
      isVisiblePlp: false,
      usedInSearch: false,
      usedInLayeredNav: false,
      isVariantForming: false,
    });
  });

  it('updates an attribute’s editable flags (label + Variant Forming) without touching code/dataType/inputType', async () => {
    const created = await admin.post('/admin/v1/attributes').send({
      code: 'trim',
      label: 'Trim',
      dataType: 'SELECT',
      inputType: 'DROPDOWN',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.isVariantForming).toBe(false);

    // The exact bug this endpoint exists to fix: an attribute created without "Variant Forming"
    // checked is otherwise stuck that way forever — there was no way to flip it after creation.
    const updated = await admin.patch('/admin/v1/attributes/trim').send({ label: 'Trim Level', isVariantForming: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data.label).toBe('Trim Level');
    expect(updated.body.data.isVariantForming).toBe(true);
    // code/dataType/inputType are untouched — not accepted by the schema at all.
    expect(updated.body.data.code).toBe('trim');
    expect(updated.body.data.dataType).toBe('SELECT');
    expect(updated.body.data.inputType).toBe('DROPDOWN');

    const list = await admin.get('/admin/v1/attributes');
    const row = list.body.data.find((a: { code: string }) => a.code === 'trim');
    expect(row.label).toBe('Trim Level');
    expect(row.isVariantForming).toBe(true);
  });

  it('404s updating an unknown attribute', async () => {
    const res = await admin.patch('/admin/v1/attributes/does-not-exist').send({ label: 'x' });
    expect(res.status).toBe(404);
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

  it('rejects deleting an attribute that is still assigned to a set, then allows it after un-assigning', async () => {
    const attr = await admin.post('/admin/v1/attributes').send({ code: 'weight-class', label: 'Weight Class', dataType: 'TEXT', inputType: 'TEXT' });
    expect(attr.status).toBe(201);
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'accessories', name: 'Accessories' });
    const group = await admin.post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`).send({ name: 'General' });
    await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'weight-class' });

    const blocked = await admin.delete('/admin/v1/attributes/weight-class');
    expect(blocked.status).toBe(409);

    const unassign = await admin.delete(`/admin/v1/attribute-sets/${set.body.data.id}/attributes/weight-class`);
    expect(unassign.status).toBe(204);

    const detail = await admin.get(`/admin/v1/attribute-sets/${set.body.data.id}`);
    expect(detail.body.data.groups[0].attributes).toEqual([]);

    const nowDeletable = await admin.delete('/admin/v1/attributes/weight-class');
    expect(nowDeletable.status).toBe(204);

    // Deleted attributes drop out of the reusable-attribute library.
    const list = await admin.get('/admin/v1/attributes');
    expect(list.body.data.map((a: { code: string }) => a.code)).not.toContain('weight-class');
  });

  it('allows deleting an attribute once the only attribute set assigning it has itself been deleted (no un-assign needed)', async () => {
    const attr = await admin.post('/admin/v1/attributes').send({ code: 'trim-level', label: 'Trim Level', dataType: 'TEXT', inputType: 'TEXT' });
    expect(attr.status).toBe(201);
    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'convertibles', name: 'Convertibles' });
    const group = await admin.post(`/admin/v1/attribute-sets/${set.body.data.id}/groups`).send({ name: 'General' });
    await admin
      .post(`/admin/v1/attribute-sets/${set.body.data.id}/attributes`)
      .send({ groupId: group.body.data.id, attributeCode: 'trim-level' });

    const blocked = await admin.delete('/admin/v1/attributes/trim-level');
    expect(blocked.status).toBe(409);

    // Delete the set directly (no product ever used it) instead of un-assigning the attribute first.
    const setDeleted = await admin.delete(`/admin/v1/attribute-sets/${set.body.data.id}`);
    expect(setDeleted.status).toBe(204);

    // The attribute-set-attribute row still exists in the DB (delete doesn't cascade-clean it),
    // but a soft-deleted set no longer counts as "in use" — the attribute must now be deletable.
    const nowDeletable = await admin.delete('/admin/v1/attributes/trim-level');
    expect(nowDeletable.status).toBe(204);
  });

  it('404s deleting an unknown attribute, and 404s un-assigning one never assigned to the set', async () => {
    const unknownAttr = await admin.delete('/admin/v1/attributes/does-not-exist');
    expect(unknownAttr.status).toBe(404);

    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'wearables', name: 'Wearables' });
    const neverAssigned = await admin.delete(`/admin/v1/attribute-sets/${set.body.data.id}/attributes/screen-size`);
    expect(neverAssigned.status).toBe(404);
  });

  it('rejects deleting an attribute set that is still used by a product, then allows it once reassigned', async () => {
    const original = await admin.post('/admin/v1/attribute-sets').send({ code: 'drones', name: 'Drones' });
    const replacement = await admin.post('/admin/v1/attribute-sets').send({ code: 'drones-v2', name: 'Drones v2' });
    const product = await admin
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku: 'ATTR-SET-DELETE-SKU-1', attributeSetId: original.body.data.id });
    expect(product.status).toBe(201);

    const blocked = await admin.delete(`/admin/v1/attribute-sets/${original.body.data.id}`);
    expect(blocked.status).toBe(409);

    const reassign = await admin
      .patch(`/admin/v1/products/${product.body.data.publicId}`)
      .send({ attributeSetId: replacement.body.data.id });
    expect(reassign.status).toBe(200);

    const nowDeletable = await admin.delete(`/admin/v1/attribute-sets/${original.body.data.id}`);
    expect(nowDeletable.status).toBe(204);

    const list = await admin.get('/admin/v1/attribute-sets');
    expect(list.body.data.map((s: { code: string }) => s.code)).not.toContain('drones');
  });

  it('404s deleting an unknown or already-deleted attribute set', async () => {
    const unknown = await admin.delete('/admin/v1/attribute-sets/999999');
    expect(unknown.status).toBe(404);
  });

  it('cleanly 409s (not 500s) re-creating an attribute or attribute set with a just-deleted code', async () => {
    // `code` is a plain, non-partial unique DB constraint — deleting a row doesn't free its code for
    // reuse, because deletedAt-filtered reads can't see the old row to report a clean pre-check conflict.
    const attr = await admin.post('/admin/v1/attributes').send({ code: 'reused-code', label: 'First', dataType: 'TEXT', inputType: 'TEXT' });
    expect(attr.status).toBe(201);
    const deleteAttr = await admin.delete('/admin/v1/attributes/reused-code');
    expect(deleteAttr.status).toBe(204);
    const recreateAttr = await admin.post('/admin/v1/attributes').send({ code: 'reused-code', label: 'Second', dataType: 'TEXT', inputType: 'TEXT' });
    expect(recreateAttr.status).toBe(409);

    const set = await admin.post('/admin/v1/attribute-sets').send({ code: 'reused-set-code', name: 'First Set' });
    expect(set.status).toBe(201);
    const deleteSet = await admin.delete(`/admin/v1/attribute-sets/${set.body.data.id}`);
    expect(deleteSet.status).toBe(204);
    const recreateSet = await admin.post('/admin/v1/attribute-sets').send({ code: 'reused-set-code', name: 'Second Set' });
    expect(recreateSet.status).toBe(409);
  });
});
