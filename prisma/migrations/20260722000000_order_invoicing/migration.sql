-- Order Management Enhancement, Phase 1 (plan/15): invoice document +
-- per-website invoice numbering.
-- Hand-written (not `prisma migrate dev`-generated) — same reason as every
-- prior migration in this project: raw-SQL-only structures (the
-- next_invoice_number() sequence function) that Prisma's diff engine
-- doesn't track and would otherwise propose dropping.

-- 1. New enum for OrderInvoice.status.
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED');

-- 2. invoice_number_counter — identical mechanics to order_number_counter
--    (prisma/sql/0004_order_raw.sql / next_order_number()).
CREATE TABLE "invoice_number_counter" (
    "website_id" BIGINT NOT NULL,
    "next_number" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_number_counter_pkey" PRIMARY KEY ("website_id")
);

ALTER TABLE "invoice_number_counter"
  ADD CONSTRAINT "invoice_number_counter_website_fk" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE;

ALTER TABLE "invoice_number_counter"
  ADD CONSTRAINT "invoice_number_counter_next_positive" CHECK ("next_number" > 0);

-- Race-safe per-website sequence — same guarantee as next_order_number():
-- the UPDATE serializes on the counter row, so two concurrent calls for the
-- same website_id can never observe or return the same next_number.
CREATE OR REPLACE FUNCTION next_invoice_number(p_website_id bigint) RETURNS bigint AS $$
DECLARE v_number bigint;
BEGIN
  INSERT INTO invoice_number_counter (website_id, next_number) VALUES (p_website_id, 1)
    ON CONFLICT (website_id) DO NOTHING;
  UPDATE invoice_number_counter
     SET next_number = next_number + 1
   WHERE website_id = p_website_id
   RETURNING next_number - 1 INTO v_number;
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- 3. order_invoice — a formatted, numbered invoice document. Multiple
--    invoices per order are supported (partial invoicing, same shape as
--    fulfillment supporting partial shipment).
CREATE TABLE "order_invoice" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" BIGINT NOT NULL,
    "invoice_number" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,4) NOT NULL,
    "grand_total" DECIMAL(18,4) NOT NULL,
    "pdf_storage_key" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_invoice_public_id_key" ON "order_invoice"("public_id");
CREATE UNIQUE INDEX "order_invoice_order_id_invoice_number_key" ON "order_invoice"("order_id", "invoice_number");
CREATE INDEX "order_invoice_order_id_idx" ON "order_invoice"("order_id");
CREATE INDEX "order_invoice_created_by_idx" ON "order_invoice"("created_by");

ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_invoice" ADD CONSTRAINT "order_invoice_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. order_invoice_line — the invoiced subset of order_line (mirrors
--    fulfillment_line's composite-PK shape).
CREATE TABLE "order_invoice_line" (
    "invoice_id" BIGINT NOT NULL,
    "order_line_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "row_total" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "order_invoice_line_pkey" PRIMARY KEY ("invoice_id", "order_line_id")
);

CREATE INDEX "order_invoice_line_order_line_id_idx" ON "order_invoice_line"("order_line_id");

ALTER TABLE "order_invoice_line" ADD CONSTRAINT "order_invoice_line_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "order_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_invoice_line" ADD CONSTRAINT "order_invoice_line_order_line_id_fkey"
  FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_invoice_line" ADD CONSTRAINT "order_invoice_line_qty_positive" CHECK ("qty" > 0);
