-- Hand-written (not `prisma migrate dev` — see 20260813110000_coupon/migration.sql's
-- header for the standing reasoning, unchanged here).

CREATE TYPE "GstTaxType" AS ENUM ('CGST', 'SGST', 'IGST');

-- state_code CHECKs below validate SHAPE only (2 digits), not membership in
-- the real CBIC code list (01-38 plus a couple of special-purpose codes) —
-- documented simplification, same style as GstTaxType's UT/SGST-labeling
-- note. A garbage-but-2-digit code just falls through splitGst()'s
-- "unknown -> IGST" default rather than being rejected outright; a real
-- gst_state_code reference table + FK is a reasonable future hardening, not
-- built here.

-- product.hsn_code — HSN (goods) / SAC (services) code, independent of
-- product.tax_class_id (already existed, previously unwired by any code path).
ALTER TABLE "product" ADD COLUMN "hsn_code" VARCHAR(8);

-- order_line.hsn_code — snapshot from product.hsn_code at order-creation time,
-- same "snapshot, not FK" convention as sku/name/tax_class_code on this table.
ALTER TABLE "order_line" ADD COLUMN "hsn_code" TEXT;

-- order_address.state_code / .gstin — structured GST jurisdiction key +
-- optional buyer GSTIN, alongside the existing freeform `region` column.
-- order_address/customer_address/website are pre-existing, potentially
-- populated tables (order_address in particular is a plan/00 §8 50M-row scale
-- target) — every CHECK below is added NOT VALID + VALIDATE CONSTRAINT
-- separately (SHARE UPDATE EXCLUSIVE, not ACCESS EXCLUSIVE) so adding it never
-- blocks concurrent reads/writes on these tables, even though every existing
-- row trivially satisfies the check (the new columns start out NULL).
ALTER TABLE "order_address" ADD COLUMN "state_code" CHAR(2);
ALTER TABLE "order_address" ADD COLUMN "gstin" VARCHAR(15);
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_state_code_format"
  CHECK (state_code IS NULL OR state_code ~ '^[0-9]{2}$') NOT VALID;
ALTER TABLE "order_address" VALIDATE CONSTRAINT "order_address_state_code_format";
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_gstin_format"
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') NOT VALID;
ALTER TABLE "order_address" VALIDATE CONSTRAINT "order_address_gstin_format";
-- A real GSTIN's first 2 characters ARE the state code — catch a state_code
-- that doesn't match a co-supplied gstin (a stale/copy-pasted GSTIN next to a
-- freshly-picked state, for example) rather than silently trusting both.
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_gstin_state_match"
  CHECK (gstin IS NULL OR state_code IS NULL OR left(gstin, 2) = state_code) NOT VALID;
ALTER TABLE "order_address" VALIDATE CONSTRAINT "order_address_gstin_state_match";

-- customer_address gets the identical trio, same reasoning (the address book
-- should collect the same fields checkout does).
ALTER TABLE "customer_address" ADD COLUMN "state_code" CHAR(2);
ALTER TABLE "customer_address" ADD COLUMN "gstin" VARCHAR(15);
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_state_code_format"
  CHECK (state_code IS NULL OR state_code ~ '^[0-9]{2}$') NOT VALID;
ALTER TABLE "customer_address" VALIDATE CONSTRAINT "customer_address_state_code_format";
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_gstin_format"
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') NOT VALID;
ALTER TABLE "customer_address" VALIDATE CONSTRAINT "customer_address_gstin_format";
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_gstin_state_match"
  CHECK (gstin IS NULL OR state_code IS NULL OR left(gstin, 2) = state_code) NOT VALID;
ALTER TABLE "customer_address" VALIDATE CONSTRAINT "customer_address_gstin_state_match";

-- website.gstin / .origin_state_code — this website's own GST registration,
-- single-registration/single-state scope (see store.prisma's doc comment).
ALTER TABLE "website" ADD COLUMN "gstin" VARCHAR(15);
ALTER TABLE "website" ADD COLUMN "origin_state_code" CHAR(2);
ALTER TABLE "website" ADD CONSTRAINT "website_state_code_format"
  CHECK (origin_state_code IS NULL OR origin_state_code ~ '^[0-9]{2}$') NOT VALID;
ALTER TABLE "website" VALIDATE CONSTRAINT "website_state_code_format";
ALTER TABLE "website" ADD CONSTRAINT "website_gstin_format"
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') NOT VALID;
ALTER TABLE "website" VALIDATE CONSTRAINT "website_gstin_format";
ALTER TABLE "website" ADD CONSTRAINT "website_gstin_state_match"
  CHECK (gstin IS NULL OR origin_state_code IS NULL OR left(gstin, 2) = origin_state_code) NOT VALID;
ALTER TABLE "website" VALIDATE CONSTRAINT "website_gstin_state_match";
-- The pair is meant to be set together (single-registration scope) — either
-- both present or both absent, never a half-configured website silently
-- falling through splitGst()'s "unknown -> IGST" default.
ALTER TABLE "website" ADD CONSTRAINT "website_gstin_state_code_paired"
  CHECK ((gstin IS NULL) = (origin_state_code IS NULL)) NOT VALID;
ALTER TABLE "website" VALIDATE CONSTRAINT "website_gstin_state_code_paired";

-- order_tax_line.tax_type — nullable. Unlike the address/website columns
-- above, this table (order_tax_line) can genuinely already hold rows with
-- real, non-null amounts wherever a merchant had already configured a
-- nonzero TaxClass before this migration (the flat-rate tax_class/
-- order_tax_line machinery shipped in 20260714030000_order, two days
-- earlier) — nullable is still correct (there's no way to retroactively know
-- which GST type those historical amounts represented), just not because "no
-- prior rows exist" as a blanket assumption.
ALTER TABLE "order_tax_line" ADD COLUMN "tax_type" "GstTaxType";
