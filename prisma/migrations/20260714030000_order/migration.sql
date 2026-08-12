-- Order management migration (tax_class, shipping_method, order_number_counter,
-- cart, cart_line, order, order_line, order_address, order_tax_line,
-- payment_transaction, fulfillment, fulfillment_line, order_return,
-- order_return_line). Assembled: generated DDL -> raw SQL (scope FKs, CHECKs,
-- currency-consistency trigger, updated_at triggers, next_order_number(),
-- indexes). See plan/08-order-management.md, plan/02 §6.

-- === Generated DDL (from `prisma migrate diff`, old schema -> current schema) ===
-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING');

-- CreateEnum
CREATE TYPE "PaymentTxnType" AS ENUM ('AUTHORIZE', 'CAPTURE', 'REFUND', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentTxnStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED');

-- CreateTable
CREATE TABLE "tax_class" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tax_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_method" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flat_rate" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shipping_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_number_counter" (
    "website_id" BIGINT NOT NULL,
    "next_number" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "order_number_counter_pkey" PRIMARY KEY ("website_id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "website_id" BIGINT NOT NULL,
    "store_view_id" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "customer_id" BIGINT,
    "customer_group_id" BIGINT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_line" (
    "id" BIGSERIAL NOT NULL,
    "cart_id" BIGINT NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_number" BIGINT NOT NULL,
    "website_id" BIGINT NOT NULL,
    "store_id" BIGINT NOT NULL,
    "store_view_id" BIGINT NOT NULL,
    "cart_id" BIGINT,
    "customer_id" BIGINT,
    "customer_group_id" BIGINT,
    "email" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "financial_status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,4) NOT NULL,
    "shipping_total" DECIMAL(18,4) NOT NULL,
    "grand_total" DECIMAL(18,4) NOT NULL,
    "shipping_method_code" TEXT,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "row_total" DECIMAL(18,4) NOT NULL,
    "tax_class_code" TEXT,
    "fulfilled_qty" INTEGER NOT NULL DEFAULT 0,
    "refunded_qty" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_address" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "type" "AddressType" NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postal_code" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "phone" TEXT,

    CONSTRAINT "order_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_tax_line" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "tax_class_code" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "order_tax_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transaction" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "type" "PaymentTxnType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentTxnStatus" NOT NULL,
    "gateway_ref" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" BIGINT NOT NULL,
    "warehouse_id" BIGINT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_number" TEXT,
    "carrier" TEXT,
    "shipped_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_line" (
    "fulfillment_id" BIGINT NOT NULL,
    "order_line_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "fulfillment_line_pkey" PRIMARY KEY ("fulfillment_id","order_line_id")
);

-- CreateTable
CREATE TABLE "order_return" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_line" (
    "return_id" BIGINT NOT NULL,
    "order_line_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "order_return_line_pkey" PRIMARY KEY ("return_id","order_line_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_class_public_id_key" ON "tax_class"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_class_code_key" ON "tax_class"("code");

-- CreateIndex
CREATE INDEX "tax_class_deleted_at_idx" ON "tax_class"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_method_public_id_key" ON "shipping_method"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_method_code_key" ON "shipping_method"("code");

-- CreateIndex
CREATE INDEX "shipping_method_deleted_at_idx" ON "shipping_method"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cart_public_id_key" ON "cart"("public_id");

-- CreateIndex
CREATE INDEX "cart_website_id_idx" ON "cart"("website_id");

-- CreateIndex
CREATE INDEX "cart_store_view_id_idx" ON "cart"("store_view_id");

-- CreateIndex
CREATE INDEX "cart_customer_group_id_idx" ON "cart"("customer_group_id");

-- CreateIndex
CREATE INDEX "cart_status_idx" ON "cart"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cart_line_cart_id_variant_id_key" ON "cart_line"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_public_id_key" ON "order"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_cart_id_key" ON "order"("cart_id");

-- CreateIndex
CREATE INDEX "order_store_id_idx" ON "order"("store_id");

-- CreateIndex
CREATE INDEX "order_store_view_id_idx" ON "order"("store_view_id");

-- CreateIndex
CREATE INDEX "order_customer_group_id_idx" ON "order"("customer_group_id");

-- CreateIndex
CREATE INDEX "order_email_idx" ON "order"("email");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE INDEX "order_created_at_idx" ON "order"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_website_id_order_number_key" ON "order"("website_id", "order_number");

-- CreateIndex
CREATE INDEX "order_line_order_id_idx" ON "order_line"("order_id");

-- CreateIndex
CREATE INDEX "order_line_variant_id_idx" ON "order_line"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_address_order_id_type_key" ON "order_address"("order_id", "type");

-- CreateIndex
CREATE INDEX "order_tax_line_order_id_idx" ON "order_tax_line"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_public_id_key" ON "fulfillment"("public_id");

-- CreateIndex
CREATE INDEX "fulfillment_order_id_idx" ON "fulfillment"("order_id");

-- CreateIndex
CREATE INDEX "fulfillment_warehouse_id_idx" ON "fulfillment"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_public_id_key" ON "order_return"("public_id");

-- CreateIndex
CREATE INDEX "order_return_order_id_idx" ON "order_return"("order_id");

-- AddForeignKey
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tax_line" ADD CONSTRAINT "order_tax_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment" ADD CONSTRAINT "fulfillment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_line" ADD CONSTRAINT "fulfillment_line_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_line" ADD CONSTRAINT "fulfillment_line_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_line" ADD CONSTRAINT "order_return_line_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "order_return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_line" ADD CONSTRAINT "order_return_line_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Raw blocks Prisma can't express (scope FKs, CHECKs, triggers, functions, indexes) ===
-- =============================================================================
-- 0004_order_raw.sql
-- Raw-SQL blocks for Order management (plan/08). Appended after the Prisma-
-- generated DDL for tax_class/shipping_method/order_number_counter/cart/cart_line/
-- order/order_line/order_address/order_tax_line/payment_transaction/fulfillment/
-- fulfillment_line/order_return/order_return_line. Reuses set_updated_at() from
-- 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Scope FKs kept as plain scalars in Prisma (project-wide convention):
--    Cart/Order -> website/store/store_view/customer_group/currency; ShippingMethod
--    -> currency; Product/OrderLine -> tax_class (soft classification, not core
--    ownership); Fulfillment -> warehouse; PaymentTransaction -> currency.
-- -----------------------------------------------------------------------------
ALTER TABLE cart
  ADD CONSTRAINT cart_website_fk        FOREIGN KEY (website_id)        REFERENCES website(id)        ON DELETE CASCADE,
  ADD CONSTRAINT cart_store_view_fk     FOREIGN KEY (store_view_id)     REFERENCES store_view(id)     ON DELETE CASCADE,
  ADD CONSTRAINT cart_customer_group_fk FOREIGN KEY (customer_group_id) REFERENCES customer_group(id) ON DELETE SET NULL,
  ADD CONSTRAINT cart_currency_fk       FOREIGN KEY (currency)          REFERENCES currency(code)     ON DELETE RESTRICT;

ALTER TABLE "order"
  ADD CONSTRAINT order_website_fk        FOREIGN KEY (website_id)        REFERENCES website(id)        ON DELETE RESTRICT,
  ADD CONSTRAINT order_store_fk          FOREIGN KEY (store_id)          REFERENCES store(id)          ON DELETE RESTRICT,
  ADD CONSTRAINT order_store_view_fk     FOREIGN KEY (store_view_id)     REFERENCES store_view(id)     ON DELETE RESTRICT,
  ADD CONSTRAINT order_customer_group_fk FOREIGN KEY (customer_group_id) REFERENCES customer_group(id) ON DELETE SET NULL,
  ADD CONSTRAINT order_currency_fk       FOREIGN KEY (currency)          REFERENCES currency(code)     ON DELETE RESTRICT;

ALTER TABLE shipping_method
  ADD CONSTRAINT shipping_method_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

ALTER TABLE product
  ADD CONSTRAINT product_tax_class_fk FOREIGN KEY (tax_class_id) REFERENCES tax_class(id) ON DELETE SET NULL;

ALTER TABLE fulfillment
  ADD CONSTRAINT fulfillment_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE RESTRICT;

ALTER TABLE order_number_counter
  ADD CONSTRAINT order_number_counter_website_fk FOREIGN KEY (website_id) REFERENCES website(id) ON DELETE CASCADE;

ALTER TABLE payment_transaction
  ADD CONSTRAINT payment_transaction_currency_fk FOREIGN KEY (currency) REFERENCES currency(code) ON DELETE RESTRICT;

-- Index every FK column added above (project-wide convention — every FK gets one).
CREATE INDEX ix_product_tax_class ON product (tax_class_id);

-- -----------------------------------------------------------------------------
-- 1. Money/quantity invariants — defense in depth (same rationale as inventory's
--    on_hand/reserved and pricing's price>=0 CHECKs).
-- -----------------------------------------------------------------------------
ALTER TABLE tax_class
  ADD CONSTRAINT tax_class_rate_range CHECK (rate >= 0 AND rate < 1); -- a fraction, not a %

ALTER TABLE shipping_method
  ADD CONSTRAINT shipping_method_flat_rate_nonneg CHECK (flat_rate >= 0);

ALTER TABLE cart_line
  ADD CONSTRAINT cart_line_qty_positive CHECK (qty > 0);

ALTER TABLE "order"
  ADD CONSTRAINT order_subtotal_nonneg CHECK (subtotal >= 0),
  ADD CONSTRAINT order_discount_nonneg CHECK (discount_total >= 0),
  ADD CONSTRAINT order_tax_nonneg CHECK (tax_total >= 0),
  ADD CONSTRAINT order_shipping_nonneg CHECK (shipping_total >= 0),
  ADD CONSTRAINT order_grand_total_nonneg CHECK (grand_total >= 0),
  -- Ties grand_total to its own components so a bug in the (application-layer)
  -- total-computation code can never silently persist a wrong frozen total —
  -- the same "defense in depth" rationale as every other CHECK in this file.
  ADD CONSTRAINT order_grand_total_consistent
    CHECK (grand_total = subtotal - discount_total + tax_total + shipping_total);

ALTER TABLE order_line
  ADD CONSTRAINT order_line_qty_positive CHECK (qty > 0),
  ADD CONSTRAINT order_line_unit_price_nonneg CHECK (unit_price >= 0),
  ADD CONSTRAINT order_line_tax_amount_nonneg CHECK (tax_amount >= 0),
  ADD CONSTRAINT order_line_discount_amount_nonneg CHECK (discount_amount >= 0),
  ADD CONSTRAINT order_line_row_total_nonneg CHECK (row_total >= 0),
  ADD CONSTRAINT order_line_fulfilled_qty_bounds CHECK (fulfilled_qty >= 0 AND fulfilled_qty <= qty),
  ADD CONSTRAINT order_line_refunded_qty_bounds CHECK (refunded_qty >= 0 AND refunded_qty <= qty);
  -- NOTE: deliberately NOT adding CHECK(fulfilled_qty + refunded_qty <= qty) here.
  -- fulfilled_qty and refunded_qty measure independent things (shipping progress
  -- vs. money-back progress) that legitimately BOTH reach the line's full qty at
  -- once — the extremely common "shipped 4, customer returns all 4 for a refund"
  -- flow requires fulfilled_qty=4 AND refunded_qty=4 on a qty=4 line simultaneously.
  -- A compound sum CHECK would incorrectly reject that. The real protection
  -- against a double-submitted refund is the standalone `refunded_qty <= qty`
  -- bound above, enforced via the guarded UPDATE in incrementRefundedQty.

ALTER TABLE order_tax_line
  ADD CONSTRAINT order_tax_line_amount_nonneg CHECK (amount >= 0);

ALTER TABLE payment_transaction
  ADD CONSTRAINT payment_transaction_amount_nonneg CHECK (amount >= 0);

ALTER TABLE fulfillment_line
  ADD CONSTRAINT fulfillment_line_qty_positive CHECK (qty > 0);

ALTER TABLE order_return_line
  ADD CONSTRAINT order_return_line_qty_positive CHECK (qty > 0);

ALTER TABLE order_number_counter
  ADD CONSTRAINT order_number_counter_next_positive CHECK (next_number > 0);

-- -----------------------------------------------------------------------------
-- 2. Cross-table currency consistency: a payment must be recorded in the same
--    currency as the order it belongs to (plan/10 §6 implies this for stored-value
--    tenders too). Not CHECK-expressible (CHECK cannot reference another table),
--    so this is a trigger — the one place in this migration a same-row CHECK
--    genuinely cannot do the job.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_payment_currency_matches_order() RETURNS trigger AS $$
DECLARE v_order_currency char(3);
BEGIN
  SELECT currency INTO v_order_currency FROM "order" WHERE id = NEW.order_id;
  IF v_order_currency IS NULL THEN
    RAISE EXCEPTION 'order % not found for payment_transaction', NEW.order_id;
  END IF;
  IF NEW.currency <> v_order_currency THEN
    RAISE EXCEPTION 'payment_transaction.currency (%) does not match order.currency (%) for order %',
      NEW.currency, v_order_currency, NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_currency_matches_order ON payment_transaction;
CREATE TRIGGER trg_payment_currency_matches_order
  BEFORE INSERT ON payment_transaction
  FOR EACH ROW EXECUTE FUNCTION check_payment_currency_matches_order();

-- -----------------------------------------------------------------------------
-- 3. updated_at triggers (mutable tables only; reuses set_updated_at()).
--    order_line is mutable (fulfilledQty/refundedQty advance post-creation) and
--    gets one too, unlike the genuinely append-only order_address/order_tax_line/
--    payment_transaction/fulfillment/fulfillment_line/order_return_line.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tax_class', 'shipping_method', 'cart', 'cart_line', 'order', 'order_line', 'order_return'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Order-number allocation (plan/08 §5): race-safe per-website sequence.
--    `next_order_number(website_id)` performs the guarded UPDATE...RETURNING and
--    auto-seeds the counter row on first use for a website. Race-safety: the
--    UPDATE serializes on the counter row itself (Postgres blocks a second
--    concurrent UPDATE on the same row until the first commits), so two
--    concurrent calls for the same website_id can never observe or return the
--    same next_number.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_order_number(p_website_id bigint) RETURNS bigint AS $$
DECLARE v_number bigint;
BEGIN
  INSERT INTO order_number_counter (website_id, next_number) VALUES (p_website_id, 1)
    ON CONFLICT (website_id) DO NOTHING;
  UPDATE order_number_counter
     SET next_number = next_number + 1
   WHERE website_id = p_website_id
   RETURNING next_number - 1 INTO v_number;
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. Query-shape indexes.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_payment_transaction_order_type ON payment_transaction (order_id, type);
CREATE INDEX ix_order_return_status ON order_return (status);
CREATE INDEX ix_order_financial_status ON "order" (financial_status);
CREATE INDEX ix_order_fulfillment_status ON "order" (fulfillment_status);

-- BRIN on the time column, mirroring stock_movement's precedent exactly (plan/07
-- §6 / plan/12 §5 partitioning deferral — see order.prisma header comment).
CREATE INDEX ix_order_created_at_brin ON "order" USING brin (created_at);

-- =============================================================================
-- End 0004_order_raw.sql
-- =============================================================================
