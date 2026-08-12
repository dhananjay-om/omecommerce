-- CreateEnum
CREATE TYPE "LoyaltyProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "LoyaltyTxnType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUST', 'REVERSE');

-- CreateEnum
CREATE TYPE "LoyaltySource" AS ENUM ('ORDER', 'ADMIN', 'CUSTOMER', 'EXPIRE', 'REVERSAL');

-- CreateTable
CREATE TABLE "loyalty_program" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "website_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LoyaltyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "points_per_currency_unit" DECIMAL(18,4) NOT NULL,
    "point_value" DECIMAL(18,4) NOT NULL,
    "redeem_min_points" INTEGER NOT NULL DEFAULT 0,
    "points_expiry_months" INTEGER,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "loyalty_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier" (
    "id" BIGSERIAL NOT NULL,
    "program_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "threshold_points" BIGINT NOT NULL,
    "earn_multiplier" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_account" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" BIGINT NOT NULL,
    "program_id" BIGINT NOT NULL,
    "points_balance" BIGINT NOT NULL DEFAULT 0,
    "lifetime_points" BIGINT NOT NULL DEFAULT 0,
    "tier_id" BIGINT,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transaction" (
    "id" BIGSERIAL NOT NULL,
    "loyalty_account_id" BIGINT NOT NULL,
    "type" "LoyaltyTxnType" NOT NULL,
    "points" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "source" "LoyaltySource" NOT NULL,
    "ref_type" TEXT,
    "ref_id" BIGINT,
    "idempotency_key" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "actor_id" BIGINT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_program_public_id_key" ON "loyalty_program"("public_id");

-- CreateIndex
CREATE INDEX "loyalty_program_deleted_at_idx" ON "loyalty_program"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyalty_program_website" ON "loyalty_program"("website_id");

-- CreateIndex
CREATE INDEX "loyalty_tier_program_id_sort_order_idx" ON "loyalty_tier"("program_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyalty_tier_program_name" ON "loyalty_tier"("program_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_account_public_id_key" ON "loyalty_account"("public_id");

-- CreateIndex
CREATE INDEX "loyalty_account_program_id_idx" ON "loyalty_account"("program_id");

-- CreateIndex
CREATE INDEX "loyalty_account_tier_id_idx" ON "loyalty_account"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyalty_account_customer_program" ON "loyalty_account"("customer_id", "program_id");

-- CreateIndex
CREATE INDEX "loyalty_transaction_loyalty_account_id_created_at_idx" ON "loyalty_transaction"("loyalty_account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_loyalty_txn_account_idempotency" ON "loyalty_transaction"("loyalty_account_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_account" ADD CONSTRAINT "loyalty_account_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_account" ADD CONSTRAINT "loyalty_account_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_account" ADD CONSTRAINT "loyalty_account_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "loyalty_tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_loyalty_account_id_fkey" FOREIGN KEY ("loyalty_account_id") REFERENCES "loyalty_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
