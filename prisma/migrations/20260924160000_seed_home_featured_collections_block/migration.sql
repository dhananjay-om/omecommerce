-- The home page "Featured Collections" heading now reads a CMS block with code
-- `home_featured_collections` (Admin > Content > Blocks). Create it once, pre-filled
-- with the heading the section always showed, so nothing changes until an admin edits
-- it. Never overwrites an existing block with that code.
INSERT INTO "cms_block" ("store_view_id", "code", "body", "status")
SELECT
  NULL,
  'home_featured_collections',
  '<p>Curated for you</p><h2>Featured Collections</h2>',
  'PUBLISHED'
WHERE NOT EXISTS (SELECT 1 FROM "cms_block" WHERE "store_view_id" IS NULL AND "code" = 'home_featured_collections');
