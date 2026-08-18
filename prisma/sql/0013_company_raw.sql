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
