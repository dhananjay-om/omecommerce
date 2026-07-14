/**
 * Idempotent seed for the Foundation (Store + Catalog core).
 * Run: `npm run db:seed` (after migrate:deploy + migrate:raw).
 * Mirrors plan/02-prisma-schema-and-migrations.md §6.5.
 */
import { PrismaClient, ProductType, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // --- reference data ---
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', symbol: '$', minorUnits: 2, name: 'US Dollar' },
  });
  const en = await prisma.language.upsert({
    where: { code: 'en-US' },
    update: {},
    create: { code: 'en-US', name: 'English', nativeName: 'English', isRtl: false },
  });

  // --- store hierarchy: Website -> Store -> StoreView ---
  const website = await prisma.website.upsert({
    where: { code: 'us_retail' },
    update: {},
    create: { code: 'us_retail', name: 'US Retail', baseCurrency: 'USD', isDefault: true },
  });
  const store = await prisma.store.upsert({
    where: { websiteId_code: { websiteId: website.id, code: 'main' } },
    update: {},
    create: { websiteId: website.id, code: 'main', name: 'Main Store' },
  });
  await prisma.storeView.upsert({
    where: { storeId_code: { storeId: store.id, code: 'en' } },
    update: {},
    create: { storeId: store.id, code: 'en', languageId: en.id, currency: 'USD' },
  });

  // --- a demo attribute set (Electronics) with a group + attribute ---
  const set = await prisma.attributeSet.upsert({
    where: { code: 'electronics' },
    update: {},
    create: { code: 'electronics', name: 'Electronics', isDefault: true },
  });
  const group = await prisma.attributeSetGroup.upsert({
    where: { attributeSetId_name: { attributeSetId: set.id, name: 'Specifications' } },
    update: {},
    create: { attributeSetId: set.id, name: 'Specifications', sortOrder: 0 },
  });
  const ram = await prisma.attribute.upsert({
    where: { code: 'ram' },
    update: {},
    create: {
      code: 'ram', label: 'RAM', dataType: 'NUMBER', inputType: 'NUMBER',
      isFilterable: true, usedInLayeredNav: true, isVariantForming: true,
    },
  });
  await prisma.attributeSetAttribute.upsert({
    where: { attributeSetId_attributeId: { attributeSetId: set.id, attributeId: ram.id } },
    update: {},
    create: { attributeSetId: set.id, groupId: group.id, attributeId: ram.id, sortOrder: 0 },
  });

  // --- a demo product with a GLOBAL + STORE_VIEW scoped attribute value ---
  const product = await prisma.product.upsert({
    where: { sku: 'SKU-1' },
    update: {},
    create: {
      type: ProductType.SIMPLE, sku: 'SKU-1', attributeSetId: set.id,
      status: ProductStatus.ACTIVE, nameDefault: 'Phone A',
    },
  });
  // GLOBAL default = 8. createMany + skipDuplicates keeps the seed idempotent and relies
  // on the NULLS NOT DISTINCT scope-unique index (nullable compound keys can't be used in
  // a Prisma upsert `where`).
  await prisma.productAttributeValue.createMany({
    data: [{ productId: product.id, attributeId: ram.id, scope: 'GLOBAL', valueInt: 8n }],
    skipDuplicates: true,
  });

  console.log('Seed complete: website=%s store=%s product=%s', website.code, store.code, product.sku);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
