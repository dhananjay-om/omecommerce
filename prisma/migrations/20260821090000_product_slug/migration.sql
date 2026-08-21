-- Migration: product_slug
-- Adds a real, storefront-routable slug to Product — same "URL-safe
-- identifier, auto-generated once at creation, then permanent" concept
-- Category.slug/Brand.slug already have; the admin's existing "URL Key"
-- field is a separate, unrelated free-text EAV attribute (never wired to
-- storefront routing) and is untouched by this migration.
--
-- Expand/backfill/contract, mirroring 20260720000000_storefront_category_
-- brand's exact technique for Category.slug's original rollout (existing
-- rows have no slug yet). The uniqueness index is built as a PARTIAL index
-- from the start this time (`WHERE deleted_at IS NULL`) — Category's and
-- Brand's own slug columns shipped as plain (non-partial) unique indexes
-- first and needed a follow-up migration (20260817100000_category_slug_
-- soft_delete_reuse, 20260818100000_brand_slug_soft_delete_reuse) once a
-- soft-deleted row's slug being permanently unreusable turned into a real
-- bug; Product's app-layer findBySlug() already filters deletedAt: null
-- (mirroring PrismaCategoryRepository.findBySlug()), so getting the index
-- right immediately avoids repeating that defect class.

ALTER TABLE "product" ADD COLUMN "slug" TEXT;

-- The outer coalesce(nullif(...), sku) mirrors slugify.ts's own `base ||
-- fallback` behavior: a name that's ONLY special characters (e.g. "!!!")
-- strips down to '', which without this second fallback would produce a
-- bare "-{id}" slug — never something a newly-created product can get
-- (CreateProduct's uniqueSlug() always falls back to sku the same way);
-- this backfill stays consistent with that for pre-existing rows too.
UPDATE "product"
   SET "slug" = coalesce(
                  nullif(trim(both '-' from lower(regexp_replace(coalesce(nullif(trim("name_default"), ''), "sku"), '[^a-zA-Z0-9]+', '-', 'g'))), ''),
                  "sku"
                ) || '-' || "id"::text
 WHERE "slug" IS NULL;

ALTER TABLE "product" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "ix_product_slug_active" ON "product"("slug") WHERE "deleted_at" IS NULL;
