-- Migration: payment_methods
-- Admin-configurable checkout payment methods (Cash on Delivery today; ONLINE
-- gateway rows like CCAvenue/PayU registerable but not yet wired to a real
-- gateway adapter). Hand-authored following this project's established
-- self-contained-migration shape (Prisma-style DDL + the same updated_at
-- trigger block every other soft-deletable table's migration attaches),
-- matching e.g. 20260819120000_b2b_companies/migration.sql.

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('COD', 'ONLINE');

-- CreateTable
CREATE TABLE "payment_method" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_public_id_key" ON "payment_method"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_code_key" ON "payment_method"("code");

-- CreateIndex
CREATE INDEX "payment_method_deleted_at_idx" ON "payment_method"("deleted_at");

-- -----------------------------------------------------------------------------
-- updated_at trigger — reuses set_updated_at() from 0001_foundation_raw.sql,
-- same DO-block-over-an-array pattern every other module's migration uses.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_method'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
