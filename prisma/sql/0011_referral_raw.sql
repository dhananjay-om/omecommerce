-- =============================================================================
-- 0011_referral_raw.sql
-- Raw-SQL blocks for the Referral program (referrer/referee tracking +
-- rewards, plan/11 §3). Appended after the Prisma-generated DDL for
-- referral_program/referral_code/referral/referral_reward. Reuses
-- set_updated_at() from 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope FK kept as a plain scalar in Prisma (project-wide convention).
--    ON DELETE RESTRICT — a website deletion must not silently orphan a
--    program, same reasoning as loyalty_program_website_fk in
--    0010_loyalty_raw.sql.
--
--    referral.qualifying_order_id is also a bare Prisma scalar, but a real
--    FK, not a polymorphic ref (schema-reviewer finding) — ON DELETE SET
--    NULL, same "non-critical link" reasoning as Cart's FKs, not RESTRICT:
--    an order being deleted shouldn't block on a referral row that merely
--    references it for audit purposes.
-- -----------------------------------------------------------------------------
ALTER TABLE referral_program
  ADD CONSTRAINT referral_program_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE RESTRICT;

ALTER TABLE referral
  ADD CONSTRAINT referral_qualifying_order_fk FOREIGN KEY (qualifying_order_id) REFERENCES "order"(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 1. updated_at triggers — referral_program/referral (referral_code has no
--    updated_at — its only post-creation mutation is uses_count, a plain
--    counter increment, not an audited field; referral_reward is append-only,
--    same as loyalty_transaction/wallet_transaction/gift_card_transaction).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['referral_program', 'referral'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Invariant CHECK constraints — defense in depth (schema-reviewer
--    finding), same discipline as product_attribute_value's
--    pav_value_present and stock_item's nonneg/positive checks.
-- -----------------------------------------------------------------------------
-- Reward amounts/points must be strictly positive (not merely >= 0) — a
-- configured referral reward of exactly zero is never meaningful, and
-- matches referral_reward_shape's own `> 0` requirement below, so a program
-- can never be configured in a way that fails at issuance time.
ALTER TABLE referral_program
  ADD CONSTRAINT referral_program_referrer_reward_shape CHECK (
    (referrer_reward_type = 'STORE_CREDIT' AND referrer_reward_amount IS NOT NULL AND referrer_reward_amount > 0 AND referrer_reward_points IS NULL)
    OR
    (referrer_reward_type = 'POINTS' AND referrer_reward_points IS NOT NULL AND referrer_reward_points > 0 AND referrer_reward_amount IS NULL)
  ),
  ADD CONSTRAINT referral_program_referee_reward_shape CHECK (
    (referee_reward_type = 'STORE_CREDIT' AND referee_reward_amount IS NOT NULL AND referee_reward_amount > 0 AND referee_reward_points IS NULL)
    OR
    (referee_reward_type = 'POINTS' AND referee_reward_points IS NOT NULL AND referee_reward_points > 0 AND referee_reward_amount IS NULL)
  ),
  ADD CONSTRAINT referral_program_max_referrals_positive CHECK (max_referrals_per_customer IS NULL OR max_referrals_per_customer > 0),
  ADD CONSTRAINT referral_program_attribution_window_positive CHECK (attribution_window_days IS NULL OR attribution_window_days > 0),
  ADD CONSTRAINT referral_program_min_order_amount_nonneg CHECK (min_order_amount IS NULL OR min_order_amount >= 0);

ALTER TABLE referral_reward
  ADD CONSTRAINT referral_reward_shape CHECK (
    (reward_type = 'STORE_CREDIT' AND amount IS NOT NULL AND amount > 0 AND points IS NULL)
    OR
    (reward_type = 'POINTS' AND points IS NOT NULL AND points > 0 AND amount IS NULL)
  );

ALTER TABLE referral_code
  ADD CONSTRAINT referral_code_uses_count_nonneg CHECK (uses_count >= 0);
