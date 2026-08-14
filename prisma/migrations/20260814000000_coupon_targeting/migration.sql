-- Hand-written (not `prisma migrate dev` — see 20260813110000_coupon/migration.sql's
-- header for the standing reasoning, unchanged here).

CREATE TYPE "CouponTargetType" AS ENUM ('CART', 'ITEM');
CREATE TYPE "CouponConditionType" AS ENUM ('PRODUCT', 'CATEGORY', 'ATTRIBUTE');

-- Both columns default so every pre-existing coupon row keeps behaving exactly
-- as before this migration (whole-cart discount, never auto-applied).
ALTER TABLE "coupon" ADD COLUMN "target_type" "CouponTargetType" NOT NULL DEFAULT 'CART';
ALTER TABLE "coupon" ADD COLUMN "is_auto_apply" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "coupon_condition" (
    "id" BIGSERIAL NOT NULL,
    "coupon_id" BIGINT NOT NULL,
    "condition_type" "CouponConditionType" NOT NULL,
    "product_id" BIGINT,
    "category_id" BIGINT,
    "attribute_id" BIGINT,
    "attribute_value" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_condition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "coupon_condition_coupon_id_idx" ON "coupon_condition"("coupon_id");
-- Partial (each column NULL ~2/3 of the time) — FK columns always indexed
-- (plan/00-master-plan.md), supports both the CASCADE-delete lookup and any
-- future "which coupons target this product/category/attribute" query.
CREATE INDEX "coupon_condition_product_id_idx" ON "coupon_condition"("product_id") WHERE "product_id" IS NOT NULL;
CREATE INDEX "coupon_condition_category_id_idx" ON "coupon_condition"("category_id") WHERE "category_id" IS NOT NULL;
CREATE INDEX "coupon_condition_attribute_id_idx" ON "coupon_condition"("attribute_id") WHERE "attribute_id" IS NOT NULL;

ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- CASCADE (unlike coupon_redemption's RESTRICT) — a condition row is meaningless
-- without its coupon and carries no audit/financial history of its own; the
-- coupon itself stays soft-delete only, so this only ever fires on a genuine
-- hard delete.
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_attribute_id_fkey"
  FOREIGN KEY ("attribute_id") REFERENCES "attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one of product_id / category_id / (attribute_id + attribute_value)
-- populated, matching condition_type — app-layer-enforced too
-- (create/update-coupon.usecase.ts) but the DB is the real guarantee, same
-- discipline as coupon's discount_type/currency pairing CHECKs.
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_product_shape"
  CHECK (
    (condition_type = 'PRODUCT' AND product_id IS NOT NULL AND category_id IS NULL AND attribute_id IS NULL AND attribute_value IS NULL)
    OR condition_type <> 'PRODUCT'
  );
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_category_shape"
  CHECK (
    (condition_type = 'CATEGORY' AND category_id IS NOT NULL AND product_id IS NULL AND attribute_id IS NULL AND attribute_value IS NULL)
    OR condition_type <> 'CATEGORY'
  );
ALTER TABLE "coupon_condition" ADD CONSTRAINT "coupon_condition_attribute_shape"
  CHECK (
    (condition_type = 'ATTRIBUTE' AND attribute_id IS NOT NULL AND attribute_value IS NOT NULL AND product_id IS NULL AND category_id IS NULL)
    OR condition_type <> 'ATTRIBUTE'
  );

-- -----------------------------------------------------------------------------
-- coupon.target_type vs. coupon_condition row-count pairing (ITEM requires >=1
-- condition row, CART requires 0). Not CHECK-expressible — a CHECK can't
-- reference another table — so this is a pair of deferred constraint triggers,
-- same pattern already established by check_payment_currency_matches_order in
-- prisma/sql/0004_order_raw.sql. DEFERRABLE INITIALLY DEFERRED so a single
-- transaction that updates target_type AND rewrites condition rows (exactly
-- what create/update-coupon.usecase.ts does) is only checked once, at commit,
-- against final state — not against a transiently-inconsistent intermediate
-- state mid-transaction.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION coupon_target_type_conditions_valid(p_coupon_id BIGINT) RETURNS boolean AS $$
DECLARE
  v_target_type "CouponTargetType";
  v_condition_count INTEGER;
BEGIN
  SELECT target_type INTO v_target_type FROM "coupon" WHERE id = p_coupon_id;
  IF v_target_type IS NULL THEN
    RETURN true; -- coupon row itself is gone (e.g. mid-CASCADE hard-delete) — nothing to enforce
  END IF;
  SELECT count(*) INTO v_condition_count FROM "coupon_condition" WHERE coupon_id = p_coupon_id;
  IF v_target_type = 'ITEM' AND v_condition_count = 0 THEN
    RETURN false;
  END IF;
  IF v_target_type = 'CART' AND v_condition_count > 0 THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_coupon_condition_target_type() RETURNS trigger AS $$
DECLARE v_coupon_id BIGINT;
BEGIN
  v_coupon_id := COALESCE(NEW.coupon_id, OLD.coupon_id);
  IF NOT coupon_target_type_conditions_valid(v_coupon_id) THEN
    RAISE EXCEPTION 'coupon % target_type/condition-row pairing violated (ITEM requires >=1 condition row, CART requires 0)', v_coupon_id;
  END IF;
  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_coupon_condition_target_type"
  AFTER INSERT OR UPDATE OR DELETE ON "coupon_condition"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_coupon_condition_target_type();

CREATE OR REPLACE FUNCTION check_coupon_target_type_change() RETURNS trigger AS $$
BEGIN
  IF NOT coupon_target_type_conditions_valid(NEW.id) THEN
    RAISE EXCEPTION 'coupon % target_type/condition-row pairing violated (ITEM requires >=1 condition row, CART requires 0)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_coupon_target_type_change"
  AFTER INSERT OR UPDATE OF "target_type" ON "coupon"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_coupon_target_type_change();
