-- CreateEnum
CREATE TYPE "ReferralQualifyingEvent" AS ENUM ('SIGNUP', 'FIRST_ORDER');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('STORE_CREDIT', 'POINTS');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('SIGNED_UP', 'QUALIFIED', 'REWARDED', 'EXPIRED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReferralBeneficiary" AS ENUM ('REFERRER', 'REFEREE');

-- AlterEnum
ALTER TYPE "WalletSource" ADD VALUE 'REFERRAL';

-- AlterEnum
ALTER TYPE "LoyaltySource" ADD VALUE 'REFERRAL';

-- CreateTable
CREATE TABLE "referral_program" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "website_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LoyaltyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "qualifying_event" "ReferralQualifyingEvent" NOT NULL DEFAULT 'FIRST_ORDER',
    "min_order_amount" DECIMAL(18,4),
    "referrer_reward_type" "ReferralRewardType" NOT NULL,
    "referrer_reward_amount" DECIMAL(18,4),
    "referrer_reward_points" BIGINT,
    "referee_reward_type" "ReferralRewardType" NOT NULL,
    "referee_reward_amount" DECIMAL(18,4),
    "referee_reward_points" BIGINT,
    "max_referrals_per_customer" INTEGER,
    "attribution_window_days" INTEGER,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "referral_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_code" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "program_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "code" CITEXT NOT NULL,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "program_id" BIGINT NOT NULL,
    "referral_code_id" BIGINT NOT NULL,
    "referrer_customer_id" BIGINT NOT NULL,
    "referee_customer_id" BIGINT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "qualifying_order_id" BIGINT,
    "qualified_at" TIMESTAMPTZ(6),
    "rewarded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_reward" (
    "id" BIGSERIAL NOT NULL,
    "referral_id" BIGINT NOT NULL,
    "beneficiary" "ReferralBeneficiary" NOT NULL,
    "reward_type" "ReferralRewardType" NOT NULL,
    "amount" DECIMAL(18,4),
    "points" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_program_public_id_key" ON "referral_program"("public_id");

-- CreateIndex
CREATE INDEX "referral_program_deleted_at_idx" ON "referral_program"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_program_website" ON "referral_program"("website_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_public_id_key" ON "referral_code"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_code_key" ON "referral_code"("code");

-- CreateIndex
CREATE INDEX "referral_code_customer_id_idx" ON "referral_code"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_code_program_customer" ON "referral_code"("program_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_public_id_key" ON "referral"("public_id");

-- CreateIndex
CREATE INDEX "referral_referrer_customer_id_idx" ON "referral"("referrer_customer_id");

-- CreateIndex
CREATE INDEX "referral_referral_code_id_idx" ON "referral"("referral_code_id");

-- CreateIndex
CREATE INDEX "referral_qualifying_order_id_idx" ON "referral"("qualifying_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_program_referee" ON "referral"("program_id", "referee_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_reward_referral_beneficiary" ON "referral_reward"("referral_id", "beneficiary");

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "referral_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "referral_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_customer_id_fkey" FOREIGN KEY ("referrer_customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_customer_id_fkey" FOREIGN KEY ("referee_customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_reward" ADD CONSTRAINT "referral_reward_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


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
