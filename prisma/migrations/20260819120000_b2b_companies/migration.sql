-- Migration: b2b_companies (plan/15 Phase 6)
-- Auto-generated via schema-to-schema diff (prisma migrate diff --from-schema-datamodel <HEAD snapshot> --to-schema-datamodel prisma/schema --script)
-- plus the raw-SQL block from prisma/sql/0013_company_raw.sql appended below.

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('ADMIN', 'BUYER');

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "company_id" BIGINT,
ADD COLUMN     "po_number" TEXT,
ADD COLUMN     "tax_exempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "company" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "website_id" BIGINT NOT NULL,
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
    "customer_group_id" BIGINT,
    "tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "tax_exemption_ref" TEXT,
    "gstin" VARCHAR(15),
    "billing_contact_name" TEXT,
    "billing_contact_email" TEXT,
    "billing_contact_phone" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_customer" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_public_id_key" ON "company"("public_id");

-- CreateIndex
CREATE INDEX "company_deleted_at_idx" ON "company"("deleted_at");

-- CreateIndex
CREATE INDEX "company_website_id_status_idx" ON "company"("website_id", "status");

-- CreateIndex
CREATE INDEX "company_customer_group_id_idx" ON "company"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_company_website_code" ON "company"("website_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "company_customer_customer_id_key" ON "company_customer"("customer_id");

-- CreateIndex
CREATE INDEX "company_customer_company_id_idx" ON "company_customer"("company_id");

-- CreateIndex
CREATE INDEX "order_company_id_created_at_idx" ON "order"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_customer" ADD CONSTRAINT "company_customer_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_customer" ADD CONSTRAINT "company_customer_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- Raw SQL: prisma/sql/0013_company_raw.sql
-- =============================================================================
-- =============================================================================
-- 0013_company_raw.sql
-- Raw-SQL blocks for B2B company accounts (plan/15 Phase 6). Appended after
-- the Prisma-generated DDL for company/company_customer and Order's new
-- company_id/tax_exempt/po_number columns. Reuses set_updated_at() from
-- 0001_foundation_raw.sql, same pattern as 0006_customer_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope/cross-context FKs (project-wide convention: kept as plain scalars
--    in Prisma, constrained here).
--
--    company.website_id is RESTRICT — a Company is a permanent business
--    record (order history, billing) like Customer/Order, not disposable
--    like Cart; a website deletion must not silently wipe out its companies.
--    Matches customer_website_fk's identical reasoning exactly.
--
--    order.company_id is RESTRICT, matching order_customer_id_fk exactly —
--    Order is a permanent financial record and must never have its
--    company_id silently nulled or cascaded away.
-- -----------------------------------------------------------------------------
ALTER TABLE company
  ADD CONSTRAINT company_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE RESTRICT;

ALTER TABLE "order"
  ADD CONSTRAINT order_company_id_fk FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 1. Shape CHECKs tying tax_exempt to its required companion field — same
--    discipline as 0011_referral_raw.sql's referrer/referee reward-shape
--    CHECKs ("type X requires companion field non-null"), not just app-layer
--    validation. Without these, an app bug could zero a GST breakdown with
--    no exemption certificate on file (company) or on a non-B2B order
--    (order) — an unauditable, undocumented zero-tax order stream.
-- -----------------------------------------------------------------------------
ALTER TABLE company
  ADD CONSTRAINT company_tax_exempt_ref_required CHECK (NOT tax_exempt OR tax_exemption_ref IS NOT NULL);

ALTER TABLE "order"
  ADD CONSTRAINT order_tax_exempt_requires_company CHECK (NOT tax_exempt OR company_id IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 2. updated_at triggers (mutable tables only) — same precedent as every
--    other module's raw file.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company', 'company_customer'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
