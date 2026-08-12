-- Storefront gaps, Phase 0a/0b (plan/14): Category.slug + Brand entity.
-- Hand-written rather than `prisma migrate dev`-generated: this project's schema
-- has extensive raw-SQL-only structures (generated columns, triggers) that Prisma's
-- diff engine doesn't know about and would otherwise propose dropping.

-- 1. Category.slug — expand/backfill/contract (existing rows have no slug yet)
ALTER TABLE "category" ADD COLUMN "slug" TEXT;

UPDATE "category"
   SET "slug" = lower(regexp_replace(coalesce("name_default", 'category'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || "id"::text
 WHERE "slug" IS NULL;

ALTER TABLE "category" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- 2. Brand entity
CREATE TABLE "brand" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_public_id_key" ON "brand"("public_id");
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");
CREATE INDEX "brand_deleted_at_idx" ON "brand"("deleted_at");

CREATE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "brand"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Product.brandId
ALTER TABLE "product" ADD COLUMN "brand_id" BIGINT;

CREATE INDEX "product_brand_id_idx" ON "product"("brand_id");

ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
