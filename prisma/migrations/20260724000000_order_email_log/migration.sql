-- Order Management Enhancement, Phase 3 (plan/15): order_email_log — an
-- append-only record of every manually-triggered order email, backing the
-- new EmailSender port + SimulatedEmailSender adapter (same
-- simulated-by-default precedent as TestPaymentGateway).
-- Hand-written (not `prisma migrate dev`-generated) — same reason as every
-- prior migration in this project.

CREATE TYPE "EmailLogStatus" AS ENUM ('SENT', 'FAILED');
CREATE TYPE "OrderEmailType" AS ENUM ('CONFIRMATION', 'INVOICE', 'SHIPMENT', 'CANCELLATION', 'REFUND', 'CUSTOM');

CREATE TABLE "order_email_log" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "email_type" "OrderEmailType" NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL,
    "provider_ref" TEXT,
    "sent_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_email_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_email_log_order_id_created_at_idx" ON "order_email_log"("order_id", "created_at");
CREATE INDEX "order_email_log_sent_by_idx" ON "order_email_log"("sent_by");

ALTER TABLE "order_email_log" ADD CONSTRAINT "order_email_log_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_email_log" ADD CONSTRAINT "order_email_log_sent_by_fkey"
  FOREIGN KEY ("sent_by") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
