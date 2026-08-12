-- Stage 3 cross-cutting infra migration (idempotency_key, outbox_event,
-- admin_user, role, permission, role_permission, admin_user_role). Assembled:
-- generated DDL -> raw SQL (audit FKs, CHECKs, triggers, indexes).
-- See plan/00 §4.8, plan/04 §1, plan/02 §6.

-- === Generated DDL (from `prisma migrate diff`, old schema -> current schema) ===
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" BIGSERIAL NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" BIGSERIAL NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" BIGSERIAL NOT NULL,
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" BIGSERIAL NOT NULL,
    "code" CITEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin_user_role" (
    "admin_user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,

    CONSTRAINT "admin_user_role_pkey" PRIMARY KEY ("admin_user_id","role_id")
);

-- CreateIndex
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_route_key_key" ON "idempotency_key"("route", "key");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_public_id_key" ON "admin_user"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- CreateIndex
CREATE INDEX "admin_user_deleted_at_idx" ON "admin_user"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");

-- CreateIndex
CREATE INDEX "role_permission_permission_id_idx" ON "role_permission"("permission_id");

-- CreateIndex
CREATE INDEX "admin_user_role_role_id_idx" ON "admin_user_role"("role_id");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- === Raw blocks Prisma can't express (audit FKs, CHECKs, triggers, indexes) ===
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
