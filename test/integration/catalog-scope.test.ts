import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/shared/infrastructure/prisma/client.js';

/**
 * Integration test: proves the Foundation migration + raw SQL + generated column all
 * work together THROUGH the app's Prisma client — not just via psql.
 * Gated on INTEGRATION=1 (CI sets it after applying the migration + raw SQL).
 */
describe.skipIf(!process.env.INTEGRATION)('catalog scope resolution (live DB)', () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    // clean slate for a deterministic run
    await prisma.$executeRawUnsafe('TRUNCATE product_attribute_value RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('resolves STORE_VIEW override over GLOBAL default', async () => {
    // seed minimal graph (idempotent-ish; ignore unique clashes from a prior run)
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
    const ram = await prisma.attribute.upsert({
      where: { code: 'ram' },
      update: {},
      create: { code: 'ram', label: 'RAM', dataType: 'NUMBER', inputType: 'NUMBER' },
    });
    const product = await prisma.product.upsert({
      where: { sku: 'SKU-INT-1' },
      update: {},
      create: { type: 'SIMPLE', sku: 'SKU-INT-1', slug: 'sku-int-1', attributeSetId: set.id, status: 'ACTIVE' },
    });

    // GLOBAL default 8, STORE_VIEW override 16
    await prisma.productAttributeValue.create({
      data: { productId: product.id, attributeId: ram.id, scope: 'GLOBAL', valueInt: 8n },
    });
    await prisma.productAttributeValue.create({
      data: {
        productId: product.id,
        attributeId: ram.id,
        scope: 'STORE_VIEW',
        storeViewId: sv.id,
        valueInt: 16n,
      },
    });

    // single-pass scope resolution (plan/02 §5)
    const rows = await prisma.$queryRaw<Array<{ value_int: bigint }>>`
      SELECT DISTINCT ON (attribute_id) value_int
      FROM product_attribute_value
      WHERE product_id = ${product.id}
        AND (store_view_id = ${sv.id} OR scope = 'GLOBAL')
      ORDER BY attribute_id, scope_rank DESC`;

    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.value_int)).toBe(16);
  });

  it('rejects a duplicate GLOBAL value (NULLS NOT DISTINCT)', async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { sku: 'SKU-INT-1' } });
    const ram = await prisma.attribute.findUniqueOrThrow({ where: { code: 'ram' } });
    await expect(
      prisma.productAttributeValue.create({
        data: { productId: product.id, attributeId: ram.id, scope: 'GLOBAL', valueInt: 99n },
      }),
    ).rejects.toThrow();
  });
});
