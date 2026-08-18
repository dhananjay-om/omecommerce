-- Category.slug's unique index was a plain index over ALL rows (including
-- soft-deleted ones), so deleting a category and recreating one with the
-- same auto-slugified name (uniqueSlug()'s findBySlug() check filters
-- deletedAt correctly, but the raw DB constraint didn't) 500s on a unique
-- violation instead of succeeding — the exact same class of bug already
-- fixed for cms_page/cms_block in 20260817080000_cms_soft_delete_reuse,
-- discovered live the same way (soft-delete + recreate colliding on a
-- slug that should have been freed up). Re-scoping to `WHERE deleted_at
-- IS NULL` lets a deleted category's slug be reused, same as page
-- handles/block codes already can be.
DROP INDEX IF EXISTS "category_slug_key";
CREATE UNIQUE INDEX "ix_category_slug_active" ON "category"("slug") WHERE "deleted_at" IS NULL;
