-- Migration: analytics_foundation
-- Phase 19 (plan/19-analytics-and-reporting.md) — the analytics/reporting
-- read model. 13 new tables: 7 daily summary tables (sales/order-status/
-- product/category/payment-method/return/fulfillment), one inventory
-- snapshot table, one per-customer daily fact table, the RFM segmentation
-- snapshot, the alert engine (rule + fired-history), and the nightly
-- reconciliation log. Every table is written only by background workers
-- (not yet built) — nothing here is a source of truth.
--
-- FK columns pointing at OLTP tables (website_id, product_id, category_id,
-- variant_id, warehouse_id, customer_id) are RESTRICT — a derived row must
-- never silently orphan — but in practice these almost never fire, since
-- every referenced table already uses soft-delete (an UPDATE, not a DELETE)
-- everywhere else in this codebase; the RESTRICT is a safety net for the
-- rare genuine hard-delete path, not the normal one.

-- CreateTable
CREATE TABLE "summary_sales_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "gross_revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "refund_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "net_revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "new_customer_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_sales_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_order_status_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_order_status_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_product_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "product_id" BIGINT NOT NULL,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_product_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_category_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_category_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_payment_method_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "success_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "refunded_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_payment_method_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_return_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "return_count" INTEGER NOT NULL DEFAULT 0,
    "return_qty" INTEGER NOT NULL DEFAULT 0,
    "return_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_return_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_inventory_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "warehouse_id" BIGINT NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reorder_point" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_inventory_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_fulfillment_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "orders_processed" INTEGER NOT NULL DEFAULT 0,
    "avg_processing_hours" DECIMAL(10,2),
    "avg_shipping_hours" DECIMAL(10,2),
    "avg_delivery_hours" DECIMAL(10,2),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summary_fulfillment_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_customer_daily" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "orders_placed" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_first_order_day" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fact_customer_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_rfm" (
    "customer_id" BIGINT NOT NULL,
    "recency_days" INTEGER NOT NULL,
    "frequency" INTEGER NOT NULL,
    "monetary" DECIMAL(18,4) NOT NULL,
    "recency_score" INTEGER NOT NULL,
    "frequency_score" INTEGER NOT NULL,
    "monetary_score" INTEGER NOT NULL,
    "segment" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_rfm_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "alert_rule" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "metric_code" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "threshold_value" DECIMAL(18,4) NOT NULL,
    "window_days" INTEGER NOT NULL DEFAULT 1,
    "recipient_emails" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "id" BIGSERIAL NOT NULL,
    "alert_rule_id" BIGINT NOT NULL,
    "fired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metric_value" DECIMAL(18,4) NOT NULL,
    "threshold_value" DECIMAL(18,4) NOT NULL,
    "message" TEXT NOT NULL,
    "notified_at" TIMESTAMPTZ(6),

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_log" (
    "id" BIGSERIAL NOT NULL,
    "date_key" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "expected_count" INTEGER NOT NULL,
    "actual_count" INTEGER NOT NULL,
    "expected_amount" DECIMAL(18,4),
    "actual_amount" DECIMAL(18,4),
    "diff_count" INTEGER NOT NULL,
    "diff_amount" DECIMAL(18,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "summary_sales_daily_website_id_date_key_idx" ON "summary_sales_daily"("website_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_sales_daily_date_website_currency" ON "summary_sales_daily"("date_key", "website_id", "currency");

CREATE INDEX "summary_order_status_daily_website_id_date_key_idx" ON "summary_order_status_daily"("website_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_order_status_daily" ON "summary_order_status_daily"("date_key", "website_id", "status");

CREATE INDEX "summary_product_daily_product_id_date_key_idx" ON "summary_product_daily"("product_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_product_daily" ON "summary_product_daily"("date_key", "website_id", "currency", "product_id");

CREATE INDEX "summary_category_daily_category_id_date_key_idx" ON "summary_category_daily"("category_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_category_daily" ON "summary_category_daily"("date_key", "website_id", "currency", "category_id");

CREATE INDEX "summary_payment_method_daily_website_id_date_key_idx" ON "summary_payment_method_daily"("website_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_payment_method_daily" ON "summary_payment_method_daily"("date_key", "website_id", "currency", "method", "gateway");

CREATE INDEX "summary_return_daily_website_id_date_key_idx" ON "summary_return_daily"("website_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_return_daily" ON "summary_return_daily"("date_key", "website_id", "currency");

CREATE INDEX "summary_inventory_daily_variant_id_date_key_idx" ON "summary_inventory_daily"("variant_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_inventory_daily" ON "summary_inventory_daily"("date_key", "variant_id", "warehouse_id");

CREATE INDEX "summary_fulfillment_daily_website_id_date_key_idx" ON "summary_fulfillment_daily"("website_id", "date_key");
CREATE UNIQUE INDEX "ux_summary_fulfillment_daily" ON "summary_fulfillment_daily"("date_key", "website_id");

CREATE INDEX "fact_customer_daily_customer_id_date_key_idx" ON "fact_customer_daily"("customer_id", "date_key");
CREATE UNIQUE INDEX "ux_fact_customer_daily" ON "fact_customer_daily"("date_key", "customer_id");

CREATE INDEX "customer_rfm_segment_idx" ON "customer_rfm"("segment");

CREATE UNIQUE INDEX "alert_rule_public_id_key" ON "alert_rule"("public_id");
-- Partial, matching the actual alert-evaluator hot-path query (schema-review
-- finding — a plain deleted_at-only index doesn't cover the worker's real
-- "active, not deleted" filter), same convention as e.g. 0003_pricing_raw.sql.
CREATE INDEX "ix_alert_rule_active" ON "alert_rule" ("metric_code") WHERE "is_active" AND "deleted_at" IS NULL;

CREATE INDEX "alert_history_alert_rule_id_fired_at_idx" ON "alert_history"("alert_rule_id", "fired_at");

CREATE INDEX "reconciliation_log_date_key_table_name_idx" ON "reconciliation_log"("date_key", "table_name");

-- AddForeignKey — analytics-internal (alert_history -> alert_rule)
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — into the OLTP tables this read model derives from. RESTRICT
-- everywhere: a summary/fact row must never silently point at nothing, but
-- since every one of these targets is soft-deleted in normal operation (an
-- UPDATE, not a DELETE), these constraints only ever engage on a genuine hard
-- delete, which none of this codebase's usecases perform today.
ALTER TABLE "summary_sales_daily" ADD CONSTRAINT "summary_sales_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_order_status_daily" ADD CONSTRAINT "summary_order_status_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_product_daily" ADD CONSTRAINT "summary_product_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_product_daily" ADD CONSTRAINT "summary_product_daily_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_category_daily" ADD CONSTRAINT "summary_category_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_category_daily" ADD CONSTRAINT "summary_category_daily_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_payment_method_daily" ADD CONSTRAINT "summary_payment_method_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_return_daily" ADD CONSTRAINT "summary_return_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_inventory_daily" ADD CONSTRAINT "summary_inventory_daily_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_inventory_daily" ADD CONSTRAINT "summary_inventory_daily_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "summary_fulfillment_daily" ADD CONSTRAINT "summary_fulfillment_daily_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fact_customer_daily" ADD CONSTRAINT "fact_customer_daily_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_rfm" ADD CONSTRAINT "customer_rfm_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- updated_at triggers — reuses set_updated_at() from 0001_foundation_raw.sql,
-- same DO-block-over-an-array pattern every other module's migration uses.
-- Only tables with a column literally named `updated_at` — set_updated_at()
-- hardcodes `NEW.updated_at := now()`, so it can't target customer_rfm's
-- differently-named `computed_at` (that column's freshness is instead
-- guaranteed by Prisma's own `@updatedAt` on every .update() call — no DB
-- trigger possible for a non-standard column name). summary_inventory_daily,
-- alert_history, and reconciliation_log are createdAt-only (append/snapshot,
-- never updated in place) and are deliberately excluded too.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'summary_sales_daily',
    'summary_order_status_daily',
    'summary_product_daily',
    'summary_category_daily',
    'summary_payment_method_daily',
    'summary_return_daily',
    'summary_fulfillment_daily',
    'fact_customer_daily',
    'alert_rule'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;
