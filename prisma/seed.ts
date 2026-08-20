/**
 * Idempotent seed for the Foundation (Store + Catalog core).
 * Run: `npm run db:seed` (after migrate:deploy + migrate:raw).
 * Mirrors plan/02-prisma-schema-and-migrations.md §6.5.
 */
import { PrismaClient, ProductType, ProductStatus } from '@prisma/client';
import { ScryptPasswordHasher } from '../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE_CODE } from '../src/modules/auth/domain/permission-catalog.js';

const prisma = new PrismaClient();
const hasher = new ScryptPasswordHasher();

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

  // --- system default attributes (plan/13): Description/Short Description/SEO fields that
  // every product's edit form shows regardless of its attribute set. Deliberately NOT assigned
  // into any AttributeSetAttribute row — AssignAttributeValues only requires the Attribute to
  // exist in the reusable library, not that it's set-scoped, so the admin UI renders these as a
  // fixed section instead of a per-set one. See apps/admin/.../products/default-attribute-groups.ts.
  const DEFAULT_ATTRIBUTES = [
    { code: 'description', label: 'Description', dataType: 'RICHTEXT', inputType: 'RICHTEXT' },
    { code: 'short_description', label: 'Short Description', dataType: 'TEXTAREA', inputType: 'TEXTAREA' },
    { code: 'url_key', label: 'URL Key', dataType: 'TEXT', inputType: 'TEXT' },
    { code: 'meta_title', label: 'Meta Title', dataType: 'TEXT', inputType: 'TEXT' },
    { code: 'meta_keywords', label: 'Meta Keywords', dataType: 'TEXT', inputType: 'TEXT' },
    { code: 'meta_description', label: 'Meta Description', dataType: 'TEXTAREA', inputType: 'TEXTAREA' },
  ] as const;
  for (const a of DEFAULT_ATTRIBUTES) {
    await prisma.attribute.upsert({ where: { code: a.code }, update: {}, create: a });
  }

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

  // --- RBAC: permissions, a super-admin role, and a default dev admin user ---
  // Permission definitions live in src/modules/auth/domain/permission-catalog.ts —
  // SyncPermissions (Stores > Admin Permissions in the admin UI) runs this exact
  // same upsert-and-grant logic against an ALREADY-seeded database, so a
  // permission added after go-live reaches existing admins without needing to
  // re-run this whole seed script (which also touches unrelated demo data).
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  const superAdminRole = await prisma.role.upsert({
    where: { code: SUPER_ADMIN_ROLE_CODE },
    update: {},
    create: { code: SUPER_ADMIN_ROLE_CODE, name: 'Super Admin' },
  });
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });
  const DEV_ADMIN_EMAIL = 'admin@ome.local';
  const DEV_ADMIN_PASSWORD = 'dev-only-password-change-me'; // dev/demo seed only — never a real credential
  const existingAdmin = await prisma.adminUser.findFirst({ where: { email: DEV_ADMIN_EMAIL } });
  if (!existingAdmin) {
    const passwordHash = await hasher.hash(DEV_ADMIN_PASSWORD);
    const admin = await prisma.adminUser.create({ data: { email: DEV_ADMIN_EMAIL, passwordHash } });
    await prisma.adminUserRole.create({ data: { adminUserId: admin.id, roleId: superAdminRole.id } });
  }

  // Default home-page widget placement — matches today's hardcoded storefront
  // section order exactly, so a freshly-seeded install's Content > Widgets
  // screen already reflects live reality instead of looking empty, and the
  // home page looks identical to before this feature existed. No natural
  // unique key to upsert against (multiple widgets of the same type are a
  // legitimate future scenario), so this is a one-time "seed only if page
  // 'home' has nothing yet" guard rather than a per-row upsert.
  const hasHomeWidgets = (await prisma.widgetInstance.count({ where: { page: 'home' } })) > 0;
  if (!hasHomeWidgets) {
    await prisma.widgetInstance.createMany({
      data: [
        { type: 'HERO_BANNER_SLIDER', page: 'home', section: 'TOP', position: 0, config: {} },
        { type: 'CATEGORY_GRID', page: 'home', section: 'MIDDLE', position: 0, title: 'Shop by Category', config: {} },
        { type: 'PROMO_BANNER_GRID', page: 'home', section: 'MIDDLE', position: 1, config: {} },
        { type: 'BRAND_GRID', page: 'home', section: 'MIDDLE', position: 2, title: 'Top Brands', config: {} },
        {
          type: 'WHY_CHOOSE_US_LIST',
          page: 'home',
          section: 'MIDDLE',
          position: 3,
          config: {
            features: [
              { icon: 'truck', title: 'Free Shipping', description: 'On all orders over $50' },
              { icon: 'shield', title: 'Secure Payment', description: '100% secure checkout' },
              { icon: 'refresh', title: 'Easy Returns', description: '30-day return policy' },
              { icon: 'chat', title: '24/7 Support', description: 'Dedicated customer care' },
            ],
          },
        },
        {
          type: 'TESTIMONIAL_LIST',
          page: 'home',
          section: 'MIDDLE',
          position: 4,
          config: {
            testimonials: [
              { name: 'Amara K.', quote: 'Fast shipping and the quality is exactly as described. My new go-to store.' },
              { name: 'Daniel R.', quote: 'Customer support helped me swap a size within minutes. Great experience.' },
              { name: 'Priya S.', quote: 'Love the selection — found things here I couldn’t find anywhere else.' },
            ],
          },
        },
      ],
    });
  }

  console.log('Seed complete: website=%s store=%s product=%s', website.code, store.code, product.sku);
  console.log('Dev admin login: %s / %s', DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
