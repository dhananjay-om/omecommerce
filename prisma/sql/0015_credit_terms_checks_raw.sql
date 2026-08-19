-- =============================================================================
-- 0015_credit_terms_checks_raw.sql
-- Two CHECK constraints deferred out of 0014_company_credit_raw.sql
-- (plan/15 Phase 7) because both reference an enum label
-- (FinancialStatus.ON_ACCOUNT, TenderType.CREDIT_TERMS) added via
-- `ALTER TYPE ... ADD VALUE` inside that SAME earlier migration — Postgres
-- refuses "unsafe use of new value of enum type" for any expression that
-- uses a just-added label before the transaction that added it has
-- committed. This migration runs afterward, in its own transaction, once
-- 0014 has committed and both labels are safe to reference. Confirmed
-- against a real Postgres 16 instance, not assumed.
-- =============================================================================

-- An ON_ACCOUNT order must have a company to bill it to — same "type X
-- requires companion field" pattern as order_tax_exempt_requires_company
-- (0013_company_raw.sql), applied to the sibling FinancialStatus value
-- 0014's migration added.
ALTER TABLE "order"
  ADD CONSTRAINT order_on_account_requires_company CHECK (financial_status <> 'ON_ACCOUNT' OR company_id IS NOT NULL);

-- cart_tender's shape CHECK (0012_checkout_tender_raw.sql §2) predates
-- CREDIT_TERMS — extend it the same way WALLET is shaped (gift_card_id
-- NULL) rather than leaving CREDIT_TERMS rows unconstrained. Drop and
-- recreate: Postgres has no ALTER CONSTRAINT for a CHECK's expression.
-- NOT VALID + a separate VALIDATE CONSTRAINT (master-plan §4's
-- expand/migrate/contract doctrine for live-table changes) instead of a
-- single validating ADD CONSTRAINT — the latter would hold a lock for the
-- full scan of cart_tender; NOT VALID only takes a brief lock to add the
-- constraint (enforced for all NEW rows immediately) and VALIDATE
-- CONSTRAINT re-checks existing rows separately with a lighter lock.
ALTER TABLE cart_tender DROP CONSTRAINT cart_tender_shape;
ALTER TABLE cart_tender
  ADD CONSTRAINT cart_tender_shape CHECK (
    (tender_type = 'WALLET' AND gift_card_id IS NULL)
    OR
    (tender_type = 'GIFT_CARD' AND gift_card_id IS NOT NULL)
    OR
    (tender_type = 'CREDIT_TERMS' AND gift_card_id IS NULL)
  ) NOT VALID;
ALTER TABLE cart_tender VALIDATE CONSTRAINT cart_tender_shape;

-- =============================================================================
-- End 0015_credit_terms_checks_raw.sql
-- =============================================================================
