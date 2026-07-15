-- Pricing migration (customer_group, price_list, product_price, price_tier).
-- Assembled: generated DDL (from `prisma migrate diff`) -> raw SQL (scope FKs,
-- CHECKs, triggers, indexes). See plan/01-domain-model-and-erd.md §7,
-- plan/02-prisma-schema-and-migrations.md §6.

-- === Generated DDL (from `prisma migrate diff`, old schema -> current schema) ===
-- CreateEnum
CREATE TYPE "PriceListType" AS ENUM ('BASE', 'WHOLESALE', 'B2B', 'SPECIAL');

-- CreateTable
CREATE TABLE "customer_group" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "customer_group_id" BIGINT,
    "website_id" BIGINT,
    "type" "PriceListType" NOT NULL DEFAULT 'BASE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "price_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price" (
    "id" BIGSERIAL NOT NULL,
    "price_list_id" BIGINT NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tier" (
    "id" BIGSERIAL NOT NULL,
    "price_list_id" BIGINT NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "min_qty" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_tier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_public_id_key" ON "customer_group"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_code_key" ON "customer_group"("code");

-- CreateIndex
CREATE INDEX "customer_group_deleted_at_idx" ON "customer_group"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_public_id_key" ON "price_list"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_code_key" ON "price_list"("code");

-- CreateIndex
CREATE INDEX "price_list_currency_customer_group_id_website_id_is_active_idx" ON "price_list"("currency", "customer_group_id", "website_id", "is_active");

-- CreateIndex
CREATE INDEX "price_list_customer_group_id_idx" ON "price_list"("customer_group_id");

-- CreateIndex
CREATE INDEX "price_list_website_id_idx" ON "price_list"("website_id");

-- CreateIndex
CREATE INDEX "price_list_deleted_at_idx" ON "price_list"("deleted_at");

-- CreateIndex
CREATE INDEX "product_price_variant_id_idx" ON "product_price"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_price_price_list_id_variant_id_key" ON "product_price"("price_list_id", "variant_id");

-- CreateIndex
CREATE INDEX "price_tier_variant_id_min_qty_idx" ON "price_tier"("variant_id", "min_qty");

-- CreateIndex
CREATE UNIQUE INDEX "price_tier_price_list_id_variant_id_min_qty_key" ON "price_tier"("price_list_id", "variant_id", "min_qty");

-- AddForeignKey
ALTER TABLE "price_list" ADD CONSTRAINT "price_list_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price" ADD CONSTRAINT "product_price_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price" ADD CONSTRAINT "product_price_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tier" ADD CONSTRAINT "price_tier_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tier" ADD CONSTRAINT "price_tier_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Raw blocks Prisma can't express (scope FKs, CHECKs, triggers, indexes) ===
-- =============================================================================
-- 0003_pricing_raw.sql
-- Raw-SQL blocks for Pricing (plan/01 §7). Appended after the Prisma-generated DDL
-- for customer_group/price_list/product_price/price_tier. Reuses set_updated_at()
-- from 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope FKs (currency, website_id kept as plain scalars in Prisma per the
--    project-wide scope-FK convention — see pricing.prisma header comment and
--    ProductAttributeValue's pav_website_fk/pav_store_fk in 0001_foundation_raw.sql).
--    ON DELETE chosen deliberately: RESTRICT on currency (a currency in active use
--    must not vanish out from under a price list); CASCADE on website (deleting a
--    website legitimately retires its website-scoped price lists).
-- -----------------------------------------------------------------------------
ALTER TABLE price_list
  ADD CONSTRAINT price_list_currency_fk FOREIGN KEY (currency)   REFERENCES currency(code) ON DELETE RESTRICT,
  ADD CONSTRAINT price_list_website_fk  FOREIGN KEY (website_id) REFERENCES website(id)    ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Money/quantity invariants — defense in depth (same rationale as inventory's
--    on_hand/reserved CHECKs, plan/07 §2).
-- -----------------------------------------------------------------------------
ALTER TABLE product_price
  ADD CONSTRAINT product_price_nonneg CHECK (price >= 0);

ALTER TABLE price_tier
  ADD CONSTRAINT price_tier_price_nonneg CHECK (price >= 0),
  ADD CONSTRAINT price_tier_min_qty_positive CHECK (min_qty > 0);

ALTER TABLE price_list
  ADD CONSTRAINT price_list_date_window CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at);

-- -----------------------------------------------------------------------------
-- 2. updated_at triggers (mutable tables only; reuses set_updated_at()).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_group', 'price_list', 'product_price', 'price_tier'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Single-default customer group (mirrors uq_one_default_website / attribute_set
--    from 0001_foundation_raw.sql §7).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_one_default_customer_group
  ON customer_group (is_default) WHERE is_default AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 4. Price-tier resolution index: "highest min_qty <= requested qty for this
--    price_list+variant" (plan/01 §7 tier resolution).
-- -----------------------------------------------------------------------------
CREATE INDEX ix_price_tier_resolve
  ON price_tier (price_list_id, variant_id, min_qty DESC);

-- -----------------------------------------------------------------------------
-- 5. Active price-list resolution: only active, in-window lists matter on the
--    read path (base/tier price resolution runs per cart line). Includes the
--    scope columns (customer_group_id, website_id) the resolver also filters on,
--    so they narrow the index scan instead of being applied as row filters after
--    it (schema-review finding: the original version only covered currency).
-- -----------------------------------------------------------------------------
CREATE INDEX ix_price_list_active_window
  ON price_list (currency, customer_group_id, website_id, priority DESC)
  WHERE is_active AND deleted_at IS NULL;

-- =============================================================================
-- End 0003_pricing_raw.sql
-- =============================================================================
