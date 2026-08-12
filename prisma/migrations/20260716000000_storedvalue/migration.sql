-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'FROZEN');

-- CreateEnum
CREATE TYPE "WalletBucket" AS ENUM ('STORE_CREDIT', 'PREPAID_TOPUP', 'CASHBACK', 'LOYALTY_CONVERSION');

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('CREDIT', 'DEBIT', 'ADJUST', 'EXPIRE');

-- CreateEnum
CREATE TYPE "WalletSource" AS ENUM ('REFUND', 'RETURN', 'GOODWILL', 'TOPUP', 'CASHBACK', 'LOYALTY', 'GIFTCARD_LOAD', 'PROMO', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "GiftCardKind" AS ENUM ('DIGITAL', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "GiftCardSource" AS ENUM ('ADMIN_ISSUED', 'PROMOTIONAL', 'REFUND');

-- CreateEnum
CREATE TYPE "GiftCardTxnType" AS ENUM ('ISSUE', 'REDEEM', 'REFUND', 'ADJUST', 'VOID', 'EXPIRE');

-- CreateTable
CREATE TABLE "wallet" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" BIGINT NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transaction" (
    "id" BIGSERIAL NOT NULL,
    "wallet_id" BIGINT NOT NULL,
    "bucket" "WalletBucket" NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source" "WalletSource" NOT NULL,
    "ref_type" TEXT,
    "ref_id" BIGINT,
    "idempotency_key" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "actor_id" BIGINT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "website_id" BIGINT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "code_last4" TEXT NOT NULL,
    "initial_amount" DECIMAL(18,4) NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "kind" "GiftCardKind" NOT NULL DEFAULT 'DIGITAL',
    "source" "GiftCardSource" NOT NULL,
    "purchaser_customer_id" BIGINT,
    "recipient_email" TEXT,
    "recipient_name" TEXT,
    "message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "gift_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transaction" (
    "id" BIGSERIAL NOT NULL,
    "gift_card_id" BIGINT NOT NULL,
    "type" "GiftCardTxnType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "ref_type" TEXT,
    "ref_id" BIGINT,
    "idempotency_key" TEXT,
    "actor_id" BIGINT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_public_id_key" ON "wallet"("public_id");

-- CreateIndex
CREATE INDEX "wallet_website_id_idx" ON "wallet"("website_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallet_customer_website_currency" ON "wallet"("customer_id", "website_id", "currency");

-- CreateIndex
CREATE INDEX "wallet_transaction_wallet_id_created_at_idx" ON "wallet_transaction"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallet_txn_wallet_idempotency" ON "wallet_transaction"("wallet_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "gift_card_public_id_key" ON "gift_card"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "gift_card_code_hash_key" ON "gift_card"("code_hash");

-- CreateIndex
CREATE INDEX "gift_card_deleted_at_idx" ON "gift_card"("deleted_at");

-- CreateIndex
CREATE INDEX "gift_card_website_id_idx" ON "gift_card"("website_id");

-- CreateIndex
CREATE INDEX "gift_card_purchaser_customer_id_idx" ON "gift_card"("purchaser_customer_id");

-- CreateIndex
CREATE INDEX "gift_card_status_idx" ON "gift_card"("status");

-- CreateIndex
CREATE INDEX "gift_card_transaction_gift_card_id_created_at_idx" ON "gift_card_transaction"("gift_card_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gift_card_txn_giftcard_idempotency" ON "gift_card_transaction"("gift_card_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
