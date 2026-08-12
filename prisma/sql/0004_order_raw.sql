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
  -- against a double-submitted refund (the scenario that motivated considering
  -- this) is the standalone `refunded_qty <= qty` bound above, enforced via the
  -- guarded UPDATE in incrementRefundedQty — a second refund attempt once
  -- refunded_qty already equals qty is correctly rejected by that alone.

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
