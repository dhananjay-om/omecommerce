-- AlterEnum: adds a real stop control for a running migration
ALTER TYPE "MigrationRunStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "migration_run" ADD COLUMN     "cancel_requested" BOOLEAN NOT NULL DEFAULT false;
