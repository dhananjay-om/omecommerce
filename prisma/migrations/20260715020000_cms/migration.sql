-- CreateEnum
CREATE TYPE "CmsStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "cms_page" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "store_view_id" BIGINT,
    "handle" CITEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cms_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_block" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "store_view_id" BIGINT,
    "code" CITEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cms_block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_public_id_key" ON "cms_page"("public_id");

-- CreateIndex
CREATE INDEX "cms_page_deleted_at_idx" ON "cms_page"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cms_page_store_view_handle" ON "cms_page"("store_view_id", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "cms_block_public_id_key" ON "cms_block"("public_id");

-- CreateIndex
CREATE INDEX "cms_block_deleted_at_idx" ON "cms_block"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cms_block_store_view_code" ON "cms_block"("store_view_id", "code");

-- =============================================================================
-- 0008_cms_raw.sql
-- Raw-SQL blocks for CMS pages/blocks (plan/05 §2.7). Appended after the
-- Prisma-generated DDL for cms_page/cms_block. Reuses set_updated_at() from
-- 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. storeViewId FKs. ON DELETE CASCADE (not SET NULL like ProductMedia's
--    identical-looking storeViewId) — see cms.prisma's header comment: the
--    unique indexes below are NULLS NOT DISTINCT, so nulling out storeViewId
--    on a store-view deletion could collide with an already-existing GLOBAL
--    row for the same handle/code and fail the transaction. Deleting the
--    store view's own CMS content along with it avoids that entirely.
-- -----------------------------------------------------------------------------
ALTER TABLE cms_page
  ADD CONSTRAINT cms_page_store_view_fk FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE CASCADE;

ALTER TABLE cms_block
  ADD CONSTRAINT cms_block_store_view_fk FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Category.landingPageCmsId predates this table (defined in Foundation
--    before cms_page existed, plan/02 §6.2 expand/migrate/contract) — add its
--    FK now that the referent exists. SET NULL is safe here: no uniqueness
--    constraint on this column, so nulling it out on a page deletion can't
--    collide with anything.
-- -----------------------------------------------------------------------------
ALTER TABLE category
  ADD CONSTRAINT category_landing_page_cms_fk FOREIGN KEY (landing_page_cms_id) REFERENCES cms_page(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. Fix scope uniqueness: NULLs must NOT be distinct, else duplicate GLOBAL
--    (store_view_id IS NULL) rows for the same handle/code slip through.
--    Same pattern as uq_pav_scope/uq_metafield_ver in 0001_foundation_raw.sql.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cms_page_store_view_handle') THEN
    ALTER TABLE cms_page DROP CONSTRAINT uq_cms_page_store_view_handle;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_cms_page_store_view_handle' AND relkind = 'i') THEN
    DROP INDEX uq_cms_page_store_view_handle;
  END IF;
END $$;
CREATE UNIQUE INDEX uq_cms_page_store_view_handle
  ON cms_page (store_view_id, handle)
  NULLS NOT DISTINCT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cms_block_store_view_code') THEN
    ALTER TABLE cms_block DROP CONSTRAINT uq_cms_block_store_view_code;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_cms_block_store_view_code' AND relkind = 'i') THEN
    DROP INDEX uq_cms_block_store_view_code;
  END IF;
END $$;
CREATE UNIQUE INDEX uq_cms_block_store_view_code
  ON cms_block (store_view_id, code)
  NULLS NOT DISTINCT;

-- -----------------------------------------------------------------------------
-- 3. Hot-path partial indexes for "resolve the published row for this
--    store view/handle" (storefront reads) and "list published/draft" (admin
--    lists) — same pattern as ix_product_active in 0001_foundation_raw.sql.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_cms_page_active  ON cms_page  (store_view_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_cms_block_active ON cms_block (store_view_id, status) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. updated_at triggers (both tables have updated_at).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cms_page', 'cms_block'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
