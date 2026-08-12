-- =============================================================================
-- 0009_storedvalue_raw.sql
-- Raw-SQL blocks for Stored Value (gift cards + wallet/store credit, plan/10).
-- Appended after the Prisma-generated DDL for wallet/wallet_transaction/
-- gift_card/gift_card_transaction. Reuses set_updated_at() from
-- 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope FKs kept as plain scalars in Prisma (project-wide convention).
--    website_id is RESTRICT on both money-bearing tables (a website deletion
--    must not silently orphan real money — same reasoning as order_website_fk).
--    purchaser_customer_id is SET NULL (optional historical metadata, not core
--    to the gift card's identity — same reasoning as customer_group_id FKs).
-- -----------------------------------------------------------------------------
ALTER TABLE wallet
  ADD CONSTRAINT wallet_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE RESTRICT;

ALTER TABLE gift_card
  ADD CONSTRAINT gift_card_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gift_card_purchaser_customer_fk FOREIGN KEY (purchaser_customer_id) REFERENCES customer(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 1. Currency FKs — every currency column in this schema gets one (see
--    cart_currency_fk/order_currency_fk/payment_transaction_currency_fk in
--    0004_order_raw.sql for the exact precedent).
-- -----------------------------------------------------------------------------
ALTER TABLE wallet
  ADD CONSTRAINT wallet_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

ALTER TABLE wallet_transaction
  ADD CONSTRAINT wallet_transaction_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

ALTER TABLE gift_card
  ADD CONSTRAINT gift_card_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

ALTER TABLE gift_card_transaction
  ADD CONSTRAINT gift_card_transaction_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. Cross-table currency consistency: a ledger row must match its parent
--    instrument's fixed currency (plan/10 §2: "a gift card / wallet bucket has
--    a fixed currency"). Not CHECK-expressible (CHECK cannot reference another
--    table), so this is a trigger — exact same pattern as
--    check_payment_currency_matches_order() in 0004_order_raw.sql.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_wallet_txn_currency_matches_wallet() RETURNS trigger AS $$
DECLARE v_wallet_currency char(3);
BEGIN
  SELECT currency INTO v_wallet_currency FROM wallet WHERE id = NEW.wallet_id;
  IF v_wallet_currency IS NULL THEN
    RAISE EXCEPTION 'wallet % not found for wallet_transaction', NEW.wallet_id;
  END IF;
  IF NEW.currency <> v_wallet_currency THEN
    RAISE EXCEPTION 'wallet_transaction.currency (%) does not match wallet.currency (%) for wallet %',
      NEW.currency, v_wallet_currency, NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_txn_currency_matches_wallet ON wallet_transaction;
CREATE TRIGGER trg_wallet_txn_currency_matches_wallet
  BEFORE INSERT ON wallet_transaction
  FOR EACH ROW EXECUTE FUNCTION check_wallet_txn_currency_matches_wallet();

CREATE OR REPLACE FUNCTION check_gift_card_txn_currency_matches_gift_card() RETURNS trigger AS $$
DECLARE v_gift_card_currency char(3);
BEGIN
  SELECT currency INTO v_gift_card_currency FROM gift_card WHERE id = NEW.gift_card_id;
  IF v_gift_card_currency IS NULL THEN
    RAISE EXCEPTION 'gift_card % not found for gift_card_transaction', NEW.gift_card_id;
  END IF;
  IF NEW.currency <> v_gift_card_currency THEN
    RAISE EXCEPTION 'gift_card_transaction.currency (%) does not match gift_card.currency (%) for gift_card %',
      NEW.currency, v_gift_card_currency, NEW.gift_card_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_card_txn_currency_matches_gift_card ON gift_card_transaction;
CREATE TRIGGER trg_gift_card_txn_currency_matches_gift_card
  BEFORE INSERT ON gift_card_transaction
  FOR EACH ROW EXECUTE FUNCTION check_gift_card_txn_currency_matches_gift_card();

-- -----------------------------------------------------------------------------
-- 3. updated_at triggers — wallet/gift_card only (the two transaction tables
--    are append-only, no updated_at).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wallet', 'gift_card'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
