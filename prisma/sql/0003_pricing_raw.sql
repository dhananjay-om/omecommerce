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
