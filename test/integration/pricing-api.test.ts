import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';

/**
 * Pricing resolution over HTTP (live DB). Proves priority-ordered resolution across
 * base/tier/customer-group/website scoping, and specifically the schema-review
 * finding: a tier-only price list (no base ProductPrice row) must still win when its
 * qty threshold is met, rather than being silently skipped by a naive join.
 * Gated on INTEGRATION=1.
 */
describe.skipIf(!process.env.INTEGRATION)('pricing API (live DB)', () => {
  const app = createApp();
  let attributeSetId = '';

  async function createVariant(sku: string): Promise<string> {
    const created = await request(app)
      .post('/admin/v1/products')
      .send({ type: 'SIMPLE', sku, attributeSetId, status: 'ACTIVE' });
    expect(created.status).toBe(201);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku } });
    return variant.publicId;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE price_tier, product_price, price_list, customer_group, product RESTART IDENTITY CASCADE',
    );
    const set = await prisma.attributeSet.upsert({
      where: { code: 'pricing-test-set' },
      update: {},
      create: { code: 'pricing-test-set', name: 'Pricing Test Set' },
    });
    attributeSetId = set.id.toString();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a customer group', async () => {
    const res = await request(app)
      .post('/admin/v1/customer-groups')
      .send({ code: 'WHOLESALE-GRP', name: 'Wholesale Customers' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('WHOLESALE-GRP');
  });

  it('resolves the base price when only one price list exists', async () => {
    const variantId = await createVariant('PRICE-SKU-1');
    await request(app)
      .post('/admin/v1/price-lists')
      .send({ code: 'BASE-USD', name: 'Base USD', currency: 'USD', type: 'BASE', priority: 0 });
    await request(app)
      .put('/admin/v1/price-lists/BASE-USD/prices')
      .send({ variantId, price: '19.99' });

    const resolved = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 1, currency: 'USD' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toEqual({ price: '19.9900', priceListCode: 'BASE-USD', source: 'base' });
  });

  it('a higher-priority customer-group price list wins over the base list', async () => {
    const variantId = await createVariant('PRICE-SKU-2');
    await request(app)
      .post('/admin/v1/price-lists')
      .send({ code: 'BASE-USD-2', name: 'Base USD 2', currency: 'USD', type: 'BASE', priority: 0 });
    await request(app).put('/admin/v1/price-lists/BASE-USD-2/prices').send({ variantId, price: '100.00' });

    await request(app)
      .post('/admin/v1/price-lists')
      .send({
        code: 'WHOLESALE-USD',
        name: 'Wholesale USD',
        currency: 'USD',
        type: 'WHOLESALE',
        priority: 10,
        customerGroupCode: 'WHOLESALE-GRP',
      });
    await request(app).put('/admin/v1/price-lists/WHOLESALE-USD/prices').send({ variantId, price: '70.00' });

    // A guest (no customer group) only sees the base list.
    const guestResolved = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 1, currency: 'USD' });
    expect(guestResolved.body.data).toEqual({ price: '100.0000', priceListCode: 'BASE-USD-2', source: 'base' });

    // A wholesale-group customer sees the higher-priority wholesale price.
    const groupResolved = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 1, currency: 'USD', customerGroupCode: 'WHOLESALE-GRP' });
    expect(groupResolved.body.data).toEqual({ price: '70.0000', priceListCode: 'WHOLESALE-USD', source: 'base' });
  });

  it('THE schema-review finding: a tier-only price list (no base row) still wins when qty qualifies', async () => {
    const variantId = await createVariant('PRICE-SKU-3');

    // Lower-priority base list WITH a base price.
    await request(app)
      .post('/admin/v1/price-lists')
      .send({ code: 'BASE-USD-3', name: 'Base USD 3', currency: 'USD', type: 'BASE', priority: 0 });
    await request(app).put('/admin/v1/price-lists/BASE-USD-3/prices').send({ variantId, price: '50.00' });

    // Higher-priority list with ONLY a tier row — no ProductPrice row at all.
    await request(app)
      .post('/admin/v1/price-lists')
      .send({ code: 'TIER-ONLY-USD', name: 'Tier Only USD', currency: 'USD', type: 'WHOLESALE', priority: 5 });
    await request(app)
      .put('/admin/v1/price-lists/TIER-ONLY-USD/tiers')
      .send({ variantId, minQty: 10, price: '40.00' });

    // qty=1 doesn't meet the tier threshold -> TIER-ONLY-USD has no price at qty=1
    // (COALESCE finds no tier AND no base row) -> resolver must fall through to
    // BASE-USD-3, NOT return null / skip straight past the higher-priority list.
    const belowThreshold = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 1, currency: 'USD' });
    expect(belowThreshold.body.data).toEqual({ price: '50.0000', priceListCode: 'BASE-USD-3', source: 'base' });

    // qty=10 meets the tier threshold -> the higher-priority TIER-ONLY-USD now has
    // a price (via its tier) and must win over BASE-USD-3, even though it has no
    // ProductPrice row of its own.
    const atThreshold = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 10, currency: 'USD' });
    expect(atThreshold.body.data).toEqual({ price: '40.0000', priceListCode: 'TIER-ONLY-USD', source: 'tier' });
  });

  it('returns 404 when no price list configures a price for the variant/currency', async () => {
    const variantId = await createVariant('PRICE-SKU-4');
    const res = await request(app)
      .get('/admin/v1/pricing/resolve')
      .query({ variantId, qty: 1, currency: 'EUR' });
    expect(res.status).toBe(404);
  });

  it('rejects a duplicate price-list code with 409, and an invalid decimal with 422', async () => {
    const dup = await request(app)
      .post('/admin/v1/price-lists')
      .send({ code: 'BASE-USD', name: 'Dup', currency: 'USD' });
    expect(dup.status).toBe(409);

    const variantId = await createVariant('PRICE-SKU-5');
    const badPrice = await request(app)
      .put('/admin/v1/price-lists/BASE-USD/prices')
      .send({ variantId, price: 'not-a-number' });
    expect(badPrice.status).toBe(422);
  });
});
