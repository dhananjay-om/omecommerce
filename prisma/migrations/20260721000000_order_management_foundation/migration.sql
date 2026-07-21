-- Order Management Enhancement, Phase 0a/0b (plan/15): status-model extension,
-- order timeline (order_status_history), order notes.
-- Hand-written (not `prisma migrate dev`-generated) — same reason as every prior
-- migration in this project: raw-SQL-only structures (triggers, generated columns)
-- that Prisma's diff engine doesn't track and would otherwise propose dropping.

-- 1. Status-model extension (appended, not inserted — see _base.prisma's comments
--    on OrderStatus/FinancialStatus/ShipmentStatus for why the textual declaration
--    order intentionally doesn't match lifecycle order).
ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'CLOSED';
ALTER TYPE "FinancialStatus" ADD VALUE 'PARTIALLY_PAID';
ALTER TYPE "FinancialStatus" ADD VALUE 'FAILED';
ALTER TYPE "ShipmentStatus" ADD VALUE 'PACKED';

-- 2. New enums for the timeline/notes tables below.
CREATE TYPE "OrderHistoryActorType" AS ENUM ('ADMIN', 'SYSTEM', 'CUSTOMER');
CREATE TYPE "OrderNoteType" AS ENUM ('INTERNAL', 'CUSTOMER');

-- 3. Order.customerIp / Order.closedAt
ALTER TABLE "order" ADD COLUMN "customer_ip" TEXT;
ALTER TABLE "order" ADD COLUMN "closed_at" TIMESTAMPTZ(6);

-- 4. order_status_history — append-only order-scoped activity timeline.
CREATE TABLE "order_status_history" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "message" TEXT,
    "actor_type" "OrderHistoryActorType" NOT NULL,
    "actor_id" BIGINT,
    "actor_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. order_note — append-only (a correction is a new note, not an edit).
CREATE TABLE "order_note" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "type" "OrderNoteType" NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_note_order_id_type_idx" ON "order_note"("order_id", "type");
CREATE INDEX "order_note_created_by_idx" ON "order_note"("created_by");

ALTER TABLE "order_note" ADD CONSTRAINT "order_note_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_note" ADD CONSTRAINT "order_note_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
