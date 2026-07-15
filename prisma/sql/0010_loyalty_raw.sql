-- =============================================================================
-- 0010_loyalty_raw.sql
-- Raw-SQL blocks for the Loyalty program (points ledger + tiers, plan/11).
-- Appended after the Prisma-generated DDL for loyalty_program/loyalty_tier/
-- loyalty_account/loyalty_transaction. Reuses set_updated_at() from
-- 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope FK kept as a plain scalar in Prisma (project-wide convention).
--    ON DELETE RESTRICT — a website deletion must not silently orphan a
--    program with real points liability, same reasoning as
--    wallet_website_fk/gift_card_website_fk in 0009_storedvalue_raw.sql.
-- -----------------------------------------------------------------------------
ALTER TABLE loyalty_program
  ADD CONSTRAINT loyalty_program_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 1. updated_at triggers — loyalty_program/loyalty_tier/loyalty_account
--    (loyalty_transaction is append-only, no updated_at).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loyalty_program', 'loyalty_tier', 'loyalty_account'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
