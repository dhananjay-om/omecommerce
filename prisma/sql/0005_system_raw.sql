-- =============================================================================
-- 0005_system_raw.sql
-- Raw-SQL blocks for Stage 3 cross-cutting infra (idempotency, outbox, admin
-- auth/RBAC). Appended after the Prisma-generated DDL for idempotency_key,
-- outbox_event, admin_user, role, permission, role_permission, admin_user_role.
-- Reuses set_updated_at() from 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Audit FKs kept as plain scalars in Prisma (project-wide scope-FK convention).
--    created_by/updated_by are self-referential to admin_user; SET NULL so
--    deleting/soft-deleting the acting admin never blocks or cascades onto the
--    audited row.
-- -----------------------------------------------------------------------------
ALTER TABLE admin_user
  ADD CONSTRAINT admin_user_created_by_fk FOREIGN KEY (created_by) REFERENCES admin_user(id) ON DELETE SET NULL,
  ADD CONSTRAINT admin_user_updated_by_fk FOREIGN KEY (updated_by) REFERENCES admin_user(id) ON DELETE SET NULL;

ALTER TABLE role
  ADD CONSTRAINT role_created_by_fk FOREIGN KEY (created_by) REFERENCES admin_user(id) ON DELETE SET NULL,
  ADD CONSTRAINT role_updated_by_fk FOREIGN KEY (updated_by) REFERENCES admin_user(id) ON DELETE SET NULL;

CREATE INDEX ix_admin_user_created_by ON admin_user (created_by);
CREATE INDEX ix_admin_user_updated_by ON admin_user (updated_by);
CREATE INDEX ix_role_created_by ON role (created_by);
CREATE INDEX ix_role_updated_by ON role (updated_by);

-- -----------------------------------------------------------------------------
-- 1. Invariants — defense in depth.
-- -----------------------------------------------------------------------------
ALTER TABLE idempotency_key
  ADD CONSTRAINT idempotency_key_expiry_after_creation CHECK (expires_at > created_at),
  -- Closes the loop on the claim/complete state machine (header comment): a
  -- COMPLETED row must carry its response; an IN_PROGRESS/FAILED row must not
  -- (nothing to replay yet, or replay was explicitly discarded).
  ADD CONSTRAINT idempotency_key_response_matches_status CHECK (
    (status = 'COMPLETED' AND response_status IS NOT NULL AND response_body IS NOT NULL) OR
    (status IN ('IN_PROGRESS', 'FAILED') AND response_status IS NULL AND response_body IS NULL)
  );

-- -----------------------------------------------------------------------------
-- 2. updated_at triggers (mutable tables only).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admin_user', 'role', 'permission', 'idempotency_key'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Query-shape indexes.
-- -----------------------------------------------------------------------------

-- The outbox relay's poll query: unpublished rows, oldest first (ORDER BY id,
-- matching the relay's actual query — see src/shared/infrastructure/outbox).
CREATE INDEX ix_outbox_event_unpublished ON outbox_event (id) WHERE published_at IS NULL;

-- BRIN on the time column, mirroring stock_movement/order's exact precedent
-- (append-only, ever-growing, time-ordered; partitioning deferred to Stage 6).
CREATE INDEX ix_outbox_event_created_at_brin ON outbox_event USING brin (created_at);

-- =============================================================================
-- End 0005_system_raw.sql
-- =============================================================================
