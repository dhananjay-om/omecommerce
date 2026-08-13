-- Hand-written (not `prisma migrate dev`, which diffs against a shadow DB
-- unaware of the raw-SQL-applied constraints/indexes from prisma/sql/*.sql
-- and would try to "fix" that as drift — see prisma/README.md and the
-- 20260720000000_storefront_category_brand migration for the same pattern).
--
-- Currency gains isDefault (drives the default currency pre-filled in the
-- admin's "New Price List" dialog) + updatedAt (it's now mutable admin
-- config, not just static ISO-4217 reference data, so "when did the default
-- change" should be auditable — same reasoning as Website/AttributeSet).

ALTER TABLE "currency" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "currency" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "currency"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Exactly one default currency, same pattern as uq_one_default_website /
-- uq_one_default_attribute_set (prisma/sql/0001_foundation_raw.sql §7) — no
-- `AND deleted_at IS NULL` clause since Currency has no soft-delete.
CREATE UNIQUE INDEX uq_one_default_currency
  ON currency (is_default) WHERE is_default;
