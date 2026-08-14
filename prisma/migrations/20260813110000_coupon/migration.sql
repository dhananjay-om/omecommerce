-- Hand-written (not `prisma migrate dev` — the shadow-DB diff engine doesn't
-- know about the raw-SQL-applied constraints/indexes in prisma/sql/*.sql and
-- proposes dropping them as drift; see prisma/README.md and the
-- 20260720000000_storefront_category_brand / 20260813104558_currency_is_default
-- migrations for the exact same reasoning and pattern).

CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "coupon" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "description" TEXT,
    "discount_type" "CouponDiscountType" NOT NULL,
    "value" NUMERIC(18,4) NOT NULL,
    "currency" CHAR(3),
    "min_subtotal" NUMERIC(18,4),
    "usage_limit" INTEGER,
    "usage_limit_per_customer" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupon_public_id_key" ON "coupon"("public_id");
CREATE UNIQUE INDEX "coupon_code_key" ON "coupon"("code");
CREATE INDEX "coupon_deleted_at_idx" ON "coupon"("deleted_at");
CREATE INDEX "coupon_is_active_idx" ON "coupon"("is_active");
CREATE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "coupon"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Scope FK, same convention as every other currency column in this schema
-- (price_list_currency_fk etc.) — RESTRICT so a currency in use can't vanish
-- out from under a coupon that references it.
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_currency_fk"
  FOREIGN KEY ("currency") REFERENCES "currency"("code") ON DELETE RESTRICT;

-- App-layer-enforced too (CreateCoupon/UpdateCoupon use-cases), but the DB is
-- the real guarantee — see coupon.prisma's header comment on this pairing.
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_fixed_amount_requires_currency"
  CHECK (discount_type <> 'FIXED_AMOUNT' OR currency IS NOT NULL);
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_percentage_forbids_currency"
  CHECK (discount_type <> 'PERCENTAGE' OR currency IS NULL);
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_percentage_value_range"
  CHECK (discount_type <> 'PERCENTAGE' OR (value >= 0 AND value <= 100));
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_value_non_negative"
  CHECK (value >= 0);
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_usage_count_non_negative"
  CHECK (usage_count >= 0);
-- A bare min_subtotal has no meaning without a unit — require currency alongside
-- it, same pairing discipline as value/FIXED_AMOUNT (schema-review finding).
-- Deliberate MVP scope-cut: a PERCENTAGE coupon (currency forbidden above) can't
-- have a minSubtotal gate this pass.
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_min_subtotal_requires_currency"
  CHECK (min_subtotal IS NULL OR currency IS NOT NULL);

CREATE TABLE "coupon_redemption" (
    "id" BIGSERIAL NOT NULL,
    "coupon_id" BIGINT NOT NULL,
    "order_id" BIGINT NOT NULL,
    "customer_id" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "discount_amount" NUMERIC(18,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupon_redemption_order_id_key" ON "coupon_redemption"("order_id");
CREATE INDEX "coupon_redemption_coupon_id_customer_id_idx" ON "coupon_redemption"("coupon_id", "customer_id");
CREATE INDEX "coupon_redemption_coupon_id_created_at_idx" ON "coupon_redemption"("coupon_id", "created_at");
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- RESTRICT, not CASCADE — this ledger is the audit trail + usageLimitPerCustomer
-- source of truth, same permanence expectation as WalletTransaction/
-- GiftCardTransaction (orders are never hard-deleted per plan/00 §4 anyway, but a
-- silent CASCADE would be the one path that could quietly lose this history).
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cart" ADD COLUMN "coupon_code" CITEXT;

ALTER TABLE "order" ADD COLUMN "coupon_code" CITEXT;
