-- Migration: email_settings
-- Admin-configurable SMTP for order transactional email, replacing the SMTP_*
-- env vars as the live source of truth once a row exists (see
-- order.module.ts's DynamicEmailSender). Hand-authored following this
-- project's established self-contained-migration shape, matching e.g.
-- 20260820130000_payment_methods/migration.sql.

-- CreateTable
CREATE TABLE "email_settings" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "from_name" TEXT,
    "from_email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_settings_public_id_key" ON "email_settings"("public_id");

-- True-singleton guard: a unique index on a constant expression allows AT
-- MOST ONE row in this table, ever — DB-enforced, not just an application-
-- layer convention (Postgres's standard "singleton table" trick).
CREATE UNIQUE INDEX "email_settings_singleton" ON "email_settings" ((true));

-- CHECKs
ALTER TABLE "email_settings"
  ADD CONSTRAINT email_settings_port_range CHECK (port > 0 AND port <= 65535),
  ADD CONSTRAINT email_settings_username_not_blank CHECK (btrim(username) <> ''),
  ADD CONSTRAINT email_settings_password_not_blank CHECK (btrim(password) <> '');

-- -----------------------------------------------------------------------------
-- updated_at trigger — reuses set_updated_at() from 0001_foundation_raw.sql,
-- same DO-block-over-an-array pattern every other module's migration uses.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_settings'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
