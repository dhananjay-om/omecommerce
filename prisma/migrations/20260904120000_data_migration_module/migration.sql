-- CreateEnum
CREATE TYPE "MigrationChannel" AS ENUM ('SHOPIFY', 'MAGENTO');

-- CreateEnum
CREATE TYPE "MigrationRunStatus" AS ENUM ('ANALYZING', 'READY', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable: singleton-per-channel source-store credential (Data Migration feature)
CREATE TABLE "migration_connection" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "channel" "MigrationChannel" NOT NULL,
    "store_url" TEXT NOT NULL,
    "api_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_tested_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "migration_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "migration_connection_public_id_key" ON "migration_connection"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_connection_channel_key" ON "migration_connection"("channel");

-- CreateTable: one row per Analyze->Start cycle
CREATE TABLE "migration_run" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "connection_id" BIGINT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'CATALOG',
    "status" "MigrationRunStatus" NOT NULL DEFAULT 'ANALYZING',
    "job_id" TEXT,
    "total_items" INTEGER,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "skipped_items" INTEGER NOT NULL DEFAULT 0,
    "failed_items" INTEGER NOT NULL DEFAULT 0,
    "plan_json" JSONB,
    "result_json" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,

    CONSTRAINT "migration_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "migration_run_public_id_key" ON "migration_run"("public_id");

-- CreateIndex
CREATE INDEX "migration_run_connection_id_created_at_idx" ON "migration_run"("connection_id", "created_at");

-- AddForeignKey
ALTER TABLE "migration_run" ADD CONSTRAINT "migration_run_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "migration_connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: source-platform-id -> local-entity-id map (idempotent re-runs)
CREATE TABLE "migration_external_ref" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "connection_id" BIGINT NOT NULL,
    "external_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "local_public_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_external_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_migration_ref_connection_type_external" ON "migration_external_ref"("connection_id", "external_type", "external_id");

-- CreateIndex
CREATE INDEX "migration_external_ref_run_id_idx" ON "migration_external_ref"("run_id");

-- AddForeignKey
ALTER TABLE "migration_external_ref" ADD CONSTRAINT "migration_external_ref_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "migration_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
