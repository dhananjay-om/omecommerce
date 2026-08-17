-- CMS pages/blocks are gaining their first-ever admin DELETE (soft-delete)
-- endpoints. The existing uq_cms_page_store_view_handle/
-- uq_cms_block_store_view_code unique indexes (0008_cms_raw.sql) are plain
-- NULLS NOT DISTINCT indexes over ALL rows, not just non-deleted ones — so
-- soft-deleting a page/block and recreating it with the same handle/code
-- would still 500 on this raw DB constraint even though the application
-- layer's existsByStoreViewAndHandle/existsByStoreViewAndCode checks (which
-- do filter deletedAt) say the handle/code is free. Re-scoping both indexes
-- to `WHERE deleted_at IS NULL` fixes that: at most one non-deleted row per
-- (store_view_id, handle/code), same NULLS NOT DISTINCT semantics as before,
-- but a deleted row no longer blocks reuse. Recreating a unique index this
-- way (DROP + CREATE) takes a brief ACCESS EXCLUSIVE lock on cms_page/
-- cms_block — both are small, admin-authored tables, so this is a
-- sub-millisecond, low-risk operation, not a concern at this table size.
DROP INDEX IF EXISTS uq_cms_page_store_view_handle;
CREATE UNIQUE INDEX uq_cms_page_store_view_handle
  ON cms_page (store_view_id, handle)
  NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS uq_cms_block_store_view_code;
CREATE UNIQUE INDEX uq_cms_block_store_view_code
  ON cms_block (store_view_id, code)
  NULLS NOT DISTINCT
  WHERE deleted_at IS NULL;
