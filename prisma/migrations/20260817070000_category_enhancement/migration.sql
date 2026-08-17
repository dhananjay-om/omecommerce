-- Category enhancement: listing image, description, SEO meta fields, and a
-- storefront-nav-visibility toggle (see catalog.prisma's Category doc
-- comments). All plain nullable columns except include_in_menu, which is a
-- NOT NULL boolean with a constant default (true) — on Postgres 11+ that's
-- still a metadata-only ADD COLUMN (no table rewrite, same reasoning already
-- verified for website.prices_include_tax earlier this session). No CHECK
-- constraints on any of these, so no NOT VALID/VALIDATE step is needed.
ALTER TABLE "category" ADD COLUMN "description" TEXT;
ALTER TABLE "category" ADD COLUMN "image_media_key" TEXT;
ALTER TABLE "category" ADD COLUMN "meta_title" VARCHAR(255);
ALTER TABLE "category" ADD COLUMN "meta_description" TEXT;
ALTER TABLE "category" ADD COLUMN "meta_keywords" VARCHAR(255);
ALTER TABLE "category" ADD COLUMN "include_in_menu" BOOLEAN NOT NULL DEFAULT true;
