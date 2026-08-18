-- Brand.slug had the exact same defect class already fixed for cms_page/
-- cms_block (20260817080000_cms_soft_delete_reuse) and category
-- (20260817100000_category_slug_soft_delete_reuse): a plain unique index
-- over ALL rows including soft-deleted ones, while the app-layer
-- findBySlug() check (PrismaBrandRepository) correctly filters
-- deletedAt: null and reports a soft-deleted brand's slug as free. Fixed
-- proactively here (flagged by schema-reviewer while reviewing the
-- category fix) before it caused a live 500 the way category's did.
-- Re-scoping to `WHERE deleted_at IS NULL` lets a deleted brand's slug be
-- reused, same as category slugs/page handles/block codes already can be.
DROP INDEX IF EXISTS "brand_slug_key";
CREATE UNIQUE INDEX "ix_brand_slug_active" ON "brand"("slug") WHERE "deleted_at" IS NULL;
