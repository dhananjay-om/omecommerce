-- Migration: checkout_tender (plan/15 Phase 5)
-- Prisma-generated DDL, followed by the raw-SQL block from prisma/sql/0012_checkout_tender_raw.sql

-- CreateEnum
CREATE TYPE "TenderType" AS ENUM ('WALLET', 'GIFT_CARD');

-- CreateEnum
CREATE TYPE "StoredValueHoldStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "WalletSource" ADD VALUE 'ORDER';

-- AlterTable
ALTER TABLE "wallet" ADD COLUMN     "held_balance" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "gift_card" ADD COLUMN     "held_balance" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cart_tender" (
    "id" BIGSERIAL NOT NULL,
    "cart_id" BIGINT NOT NULL,
    "tender_type" "TenderType" NOT NULL,
    "gift_card_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_value_hold" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "tender_type" "TenderType" NOT NULL,
    "wallet_id" BIGINT,
    "gift_card_id" BIGINT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "ref_type" "ReservationRefType" NOT NULL,
    "ref_id" BIGINT NOT NULL,
    "status" "StoredValueHoldStatus" NOT NULL DEFAULT 'HELD',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_value_hold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cart_tender_cart_id_idx" ON "cart_tender"("cart_id");

-- CreateIndex
CREATE INDEX "cart_tender_gift_card_id_idx" ON "cart_tender"("gift_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cart_tender_cart_type_giftcard" ON "cart_tender"("cart_id", "tender_type", "gift_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_value_hold_public_id_key" ON "stored_value_hold"("public_id");

-- CreateIndex
CREATE INDEX "stored_value_hold_wallet_id_idx" ON "stored_value_hold"("wallet_id");

-- CreateIndex
CREATE INDEX "stored_value_hold_gift_card_id_idx" ON "stored_value_hold"("gift_card_id");

-- AddForeignKey
ALTER TABLE "cart_tender" ADD CONSTRAINT "cart_tender_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_tender" ADD CONSTRAINT "cart_tender_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_value_hold" ADD CONSTRAINT "stored_value_hold_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_value_hold" ADD CONSTRAINT "stored_value_hold_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- =============================================================================
-- 0012_checkout_tender_raw.sql
-- Raw-SQL blocks for checkout tender (plan/15 Phase 5) — appended after the
-- Prisma-generated DDL for cart_tender/stored_value_hold and the new
-- wallet.held_balance/gift_card.held_balance columns. Assumes
-- 0001_foundation_raw.sql (set_updated_at) and 0009_storedvalue_raw.sql
-- already ran.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. `available` generated columns (STORED) — the StockItem.available pattern,
--    applied to Wallet/GiftCard. A new hold is guarded against this, not
--    `balance` directly (mirrors PrismaStockLedger.reserve's
--    `(on_hand - reserved) >= qty` guard exactly).
-- -----------------------------------------------------------------------------
ALTER TABLE wallet
  ADD COLUMN available numeric(18,4) GENERATED ALWAYS AS (balance - held_balance) STORED;

ALTER TABLE gift_card
  ADD COLUMN available numeric(18,4) GENERATED ALWAYS AS (balance - held_balance) STORED;

-- -----------------------------------------------------------------------------
-- 2. Invariant CHECK constraints — defense in depth, same discipline as
--    stock_item's on_hand/reserved/reserved_le_on_hand checks (0002_inventory_raw.sql).
--    balance >= 0 was previously enforced only by the guarded-UPDATE debit
--    query's WHERE clause; added as a DB-level backstop now that this file is
--    already touching both tables.
-- -----------------------------------------------------------------------------
ALTER TABLE wallet
  ADD CONSTRAINT wallet_balance_nonneg CHECK (balance >= 0),
  ADD CONSTRAINT wallet_held_balance_nonneg CHECK (held_balance >= 0),
  ADD CONSTRAINT wallet_held_balance_le_balance CHECK (held_balance <= balance);

ALTER TABLE gift_card
  ADD CONSTRAINT gift_card_balance_nonneg CHECK (balance >= 0),
  ADD CONSTRAINT gift_card_held_balance_nonneg CHECK (held_balance >= 0),
  ADD CONSTRAINT gift_card_held_balance_le_balance CHECK (held_balance <= balance);

-- A zero/negative hold amount would let the guarded UPDATE (held_balance =
-- held_balance + amount) silently DECREMENT held_balance under the guise of a
-- normal hold insert — same reasoning as stock_reservation_qty_positive.
ALTER TABLE stored_value_hold
  ADD CONSTRAINT stored_value_hold_amount_positive CHECK (amount > 0);

-- Exactly one of wallet_id/gift_card_id, matching tender_type — same shape-CHECK
-- pattern as referral_reward_shape (0011_referral_raw.sql).
ALTER TABLE stored_value_hold
  ADD CONSTRAINT stored_value_hold_shape CHECK (
    (tender_type = 'WALLET' AND wallet_id IS NOT NULL AND gift_card_id IS NULL)
    OR
    (tender_type = 'GIFT_CARD' AND gift_card_id IS NOT NULL AND wallet_id IS NULL)
  );

-- Same shape-CHECK on cart_tender — the NULLS NOT DISTINCT unique index in
-- §6 below only collapses rows where gift_card_id is NULL on BOTH sides; it
-- does nothing to stop two WALLET rows with two DIFFERENT (wrongly
-- populated) gift_card_id values, which would silently violate "WALLET is a
-- singleton per cart" (schema-reviewer finding).
ALTER TABLE cart_tender
  ADD CONSTRAINT cart_tender_shape CHECK (
    (tender_type = 'WALLET' AND gift_card_id IS NULL)
    OR
    (tender_type = 'GIFT_CARD' AND gift_card_id IS NOT NULL)
  );

-- Every currency column in the codebase gets a currency FK (0009_storedvalue_raw.sql's
-- rule, applied here too — schema-reviewer finding: stored_value_hold.currency was
-- the one column left without this guarantee).
ALTER TABLE stored_value_hold
  ADD CONSTRAINT stored_value_hold_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 3. Cross-table currency consistency: a hold must match its owning
--    instrument's fixed currency — same pattern as
--    check_wallet_txn_currency_matches_wallet()/
--    check_gift_card_txn_currency_matches_gift_card() in 0009_storedvalue_raw.sql,
--    just branching on which of the two instrument columns is set. BEFORE
--    INSERT only: wallet_id/gift_card_id/currency are immutable after
--    creation — only `status` (and updated_at) ever change post-insert.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_stored_value_hold_currency() RETURNS trigger AS $$
DECLARE v_currency char(3);
BEGIN
  IF NEW.wallet_id IS NOT NULL THEN
    SELECT currency INTO v_currency FROM wallet WHERE id = NEW.wallet_id;
    IF v_currency IS NULL THEN
      RAISE EXCEPTION 'wallet % not found for stored_value_hold', NEW.wallet_id;
    END IF;
  ELSE
    SELECT currency INTO v_currency FROM gift_card WHERE id = NEW.gift_card_id;
    IF v_currency IS NULL THEN
      RAISE EXCEPTION 'gift_card % not found for stored_value_hold', NEW.gift_card_id;
    END IF;
  END IF;
  IF NEW.currency <> v_currency THEN
    RAISE EXCEPTION 'stored_value_hold.currency (%) does not match instrument currency (%)', NEW.currency, v_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stored_value_hold_currency ON stored_value_hold;
CREATE TRIGGER trg_stored_value_hold_currency
  BEFORE INSERT ON stored_value_hold
  FOR EACH ROW EXECUTE FUNCTION check_stored_value_hold_currency();

-- -----------------------------------------------------------------------------
-- 4. updated_at trigger (reuses set_updated_at() from 0001_foundation_raw.sql).
--    cart_tender is excluded — like cart_line, it has no updatedAt (create/
--    delete only, no in-place mutation).
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_at ON stored_value_hold;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON stored_value_hold
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Hold lookups — same three-index shape as stock_reservation
--    (0002_inventory_raw.sql): active-by-owner (hot path for placing a new
--    hold), expiry-sweep, and by-ref (find every hold for a cart/order). A
--    fourth partial index covers "find what funded this order" (RefundOrder's
--    split-tender lookup), which stock_reservation has no equivalent of since
--    inventory holds are always released or committed, never queried after
--    the fact by ref for a settled order.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_stored_value_hold_wallet_active
  ON stored_value_hold (wallet_id) WHERE status = 'HELD';

CREATE INDEX ix_stored_value_hold_giftcard_active
  ON stored_value_hold (gift_card_id) WHERE status = 'HELD';

CREATE INDEX ix_stored_value_hold_expiry_sweep
  ON stored_value_hold (expires_at) WHERE status = 'HELD';

CREATE INDEX ix_stored_value_hold_ref_held
  ON stored_value_hold (ref_type, ref_id) WHERE status = 'HELD';

CREATE INDEX ix_stored_value_hold_ref_captured
  ON stored_value_hold (ref_type, ref_id) WHERE status = 'CAPTURED';

-- -----------------------------------------------------------------------------
-- 6. cart_tender: WALLET is a singleton per cart (gift_card_id NULL), GIFT_CARD
--    is one row per distinct card — both enforced by one NULLS NOT DISTINCT
--    unique index (Prisma's @@unique treats NULLs as distinct, which would
--    let duplicate WALLET rows slip through — same fix as
--    uq_wallet_customer_website_currency-style scope uniqueness elsewhere).
--    Prisma may emit @@unique(map:) as either a CONSTRAINT or a plain unique
--    INDEX depending on version; drop whichever exists before recreating
--    with NULLS NOT DISTINCT (same defensive pattern as uq_pav_scope in
--    0001_foundation_raw.sql).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cart_tender_cart_type_giftcard') THEN
    ALTER TABLE cart_tender DROP CONSTRAINT uq_cart_tender_cart_type_giftcard;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_cart_tender_cart_type_giftcard' AND relkind = 'i') THEN
    DROP INDEX uq_cart_tender_cart_type_giftcard;
  END IF;
END $$;
CREATE UNIQUE INDEX uq_cart_tender_cart_type_giftcard
  ON cart_tender (cart_id, tender_type, gift_card_id) NULLS NOT DISTINCT;

-- =============================================================================
-- End 0012_checkout_tender_raw.sql
-- =============================================================================
