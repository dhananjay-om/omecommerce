-- Banners + Widgets (see banner.prisma / widget.prisma header comments).
-- Two new, independent tables — no FKs to any existing table, no backfill,
-- no drop/alter of anything pre-existing. Plain CREATE TABLE/TYPE/INDEX only.

-- CreateEnum
CREATE TYPE "BannerGroup" AS ENUM ('HERO', 'PROMO');

-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('CMS_BLOCK', 'HERO_BANNER_SLIDER', 'PROMO_BANNER_GRID', 'CATEGORY_GRID', 'BRAND_GRID', 'WHY_CHOOSE_US_LIST', 'TESTIMONIAL_LIST');

-- CreateEnum
CREATE TYPE "WidgetSection" AS ENUM ('TOP', 'MIDDLE', 'FOOTER');

-- CreateTable
CREATE TABLE "banner" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "group" "BannerGroup" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_media_key" TEXT,
    "cta_label" TEXT,
    "cta_href" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_instance" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "WidgetType" NOT NULL,
    "page" TEXT NOT NULL DEFAULT 'home',
    "section" "WidgetSection" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "widget_instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banner_public_id_key" ON "banner"("public_id");

-- CreateIndex
CREATE INDEX "banner_deleted_at_idx" ON "banner"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "widget_instance_public_id_key" ON "widget_instance"("public_id");

-- CreateIndex
CREATE INDEX "widget_instance_deleted_at_idx" ON "widget_instance"("deleted_at");

-- Partial "active" indexes for the actual hot storefront query shape
-- (WHERE group/section = $1 AND is_active = true AND deleted_at IS NULL
-- ORDER BY position — see BannerRepository.listActiveByGroup /
-- WidgetInstanceRepository.listActiveForSection), same pattern as
-- ix_cms_page_active/ix_cms_block_active in 0008_cms_raw.sql — partial on
-- deleted_at IS NULL rather than a plain composite index, so a soft-deleted
-- row can never satisfy this index regardless of its is_active value.
CREATE INDEX "ix_banner_active" ON "banner"("group", "is_active", "position") WHERE "deleted_at" IS NULL;
CREATE INDEX "ix_widget_instance_active" ON "widget_instance"("page", "section", "is_active", "position") WHERE "deleted_at" IS NULL;

-- updated_at triggers (both tables have updated_at) — reuses set_updated_at()
-- from 0001_foundation_raw.sql, same pattern as every other module's raw-SQL
-- trigger installation this session (e.g. 0008_cms_raw.sql §4).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['banner', 'widget_instance'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
