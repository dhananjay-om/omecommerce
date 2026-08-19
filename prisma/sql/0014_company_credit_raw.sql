-- =============================================================================
-- 0014_company_credit_raw.sql
-- Raw-SQL blocks for B2B Net-X credit terms (plan/15 Phase 7). Appended after
-- the Prisma-generated DDL for company_credit_account/company_credit_transaction
-- (Prisma itself generates the company_id/credit_account_id FKs — both are
-- real relations, unlike the bare-scalar scope FKs elsewhere in this schema).
-- Reuses set_updated_at() from 0001_foundation_raw.sql. Assumes
-- 0009_storedvalue_raw.sql and 0012_checkout_tender_raw.sql already ran.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Invariant CHECK constraints — defense in depth, same discipline as
--    wallet's balance/held_balance checks (0012_checkout_tender_raw.sql §2):
--    outstanding is guarded against creditLimit by charge()'s own guarded
--    UPDATE, but a DB-level backstop catches anything that bypasses it.
-- -----------------------------------------------------------------------------
ALTER TABLE company_credit_account
  ADD CONSTRAINT company_credit_account_limit_nonneg CHECK (credit_limit >= 0),
  ADD CONSTRAINT company_credit_account_outstanding_nonneg CHECK (outstanding >= 0),
  ADD CONSTRAINT company_credit_account_outstanding_le_limit CHECK (outstanding <= credit_limit);

-- A zero-amount transaction would be a no-op ledger row (and, for CHARGE,
-- could be used to slip a dueAt-bearing row into the aging report for
-- nothing actually owed) — same reasoning as stored_value_hold_amount_positive.
ALTER TABLE company_credit_transaction
  ADD CONSTRAINT company_credit_transaction_amount_nonzero CHECK (amount <> 0);

-- Sign(amount) must match type — CHARGE increases outstanding (positive),
-- PAYMENT/WRITE_OFF decrease it (negative); ADJUST is deliberately
-- unconstrained (a signed admin correction, either direction). Without this,
-- a wrongly-signed CHARGE would pass every other CHECK here while silently
-- *decreasing* outstanding under the guise of money owed — corrupting the
-- aging report's entire premise with no trace (schema-reviewer finding).
ALTER TABLE company_credit_transaction
  ADD CONSTRAINT company_credit_transaction_sign_matches_type CHECK (
    (type = 'CHARGE' AND amount > 0)
    OR (type IN ('PAYMENT', 'WRITE_OFF') AND amount < 0)
    OR (type = 'ADJUST')
  );

-- due_at is set if and only if type=CHARGE — same "type X requires companion
-- field" shape-CHECK discipline as 0013_company_raw.sql's
-- company_tax_exempt_ref_required. Catches an app-layer bug that fails to
-- compute dueAt for a CHARGE before it can silently vanish from any aging
-- query filtered on due_at IS NOT NULL.
ALTER TABLE company_credit_transaction
  ADD CONSTRAINT company_credit_transaction_charge_due_at CHECK ((type = 'CHARGE') = (due_at IS NOT NULL));

-- Every currency column gets a currency FK (0009_storedvalue_raw.sql's rule).
ALTER TABLE company_credit_account
  ADD CONSTRAINT company_credit_account_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

ALTER TABLE company_credit_transaction
  ADD CONSTRAINT company_credit_transaction_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

-- NOTE: the ON_ACCOUNT-requires-company CHECK and the CREDIT_TERMS-aware
-- cart_tender_shape retrofit are NOT here — Postgres refuses to reference a
-- brand-new `ALTER TYPE ... ADD VALUE` label (ON_ACCOUNT/CREDIT_TERMS, both
-- added earlier in THIS SAME migration by Prisma's own generated DDL) inside
-- the same transaction that added it ("unsafe use of new value of enum
-- type" — confirmed against a real Postgres 16, not assumed). Deferred to
-- 0015_credit_terms_checks_raw.sql, its own migration/transaction, applied
-- immediately after this one commits.
--
-- -----------------------------------------------------------------------------
-- 2. Cross-table currency consistency: a transaction must match its owning
--    account's fixed currency — same pattern as
--    check_wallet_txn_currency_matches_wallet() (0009_storedvalue_raw.sql).
--    BEFORE INSERT only: company_credit_transaction is append-only.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_company_credit_txn_currency() RETURNS trigger AS $$
DECLARE v_currency char(3);
BEGIN
  SELECT currency INTO v_currency FROM company_credit_account WHERE id = NEW.credit_account_id;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'company_credit_account % not found for company_credit_transaction', NEW.credit_account_id;
  END IF;
  IF NEW.currency <> v_currency THEN
    RAISE EXCEPTION 'company_credit_transaction.currency (%) does not match account currency (%)', NEW.currency, v_currency;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_credit_txn_currency ON company_credit_transaction;
CREATE TRIGGER trg_company_credit_txn_currency
  BEFORE INSERT ON company_credit_transaction
  FOR EACH ROW EXECUTE FUNCTION check_company_credit_txn_currency();

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger — company_credit_transaction is excluded (append-only,
--    no updatedAt column, same as wallet_transaction).
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_at ON company_credit_account;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON company_credit_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Lookup indexes:
--    - (ref_type, ref_id) WHERE type='CHARGE' — reversing a charge (checkout
--      rollback, order cancellation) looks up the exact CHARGE row for a
--      given Cart. No plain @@index([refType, refId]) exists in the Prisma
--      schema for this table — this partial index is the only one, same
--      "raw SQL supersedes, doesn't duplicate" pattern StoredValueHold's own
--      ref-based indexes follow.
--    - (credit_account_id, due_at) WHERE type='CHARGE' — the aging report's
--      actual access pattern (bucket by days-past-due, scoped to one
--      company's account), which the first index doesn't serve at all.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_company_credit_transaction_charge_ref
  ON company_credit_transaction (ref_type, ref_id) WHERE type = 'CHARGE';

CREATE INDEX ix_company_credit_transaction_charge_due
  ON company_credit_transaction (credit_account_id, due_at) WHERE type = 'CHARGE';

-- =============================================================================
-- End 0014_company_credit_raw.sql — see 0015_credit_terms_checks_raw.sql for
-- the two CHECK constraints that couldn't live here.
-- =============================================================================
