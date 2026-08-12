-- =============================================================================
-- 0002_inventory_raw.sql
-- Raw-SQL blocks for the Inventory ledger (plan/07-inventory-architecture.md).
-- Appended after the Prisma-generated DDL for warehouse/stock_item/stock_movement/
-- stock_reservation/store_warehouse. Assumes 0001_foundation_raw.sql already ran
-- (reuses its set_updated_at() trigger function).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. `available` generated column (STORED). Not declared in Prisma schema — same
--    pattern as product_attribute_value.scope_rank (plan/02 §7b).
-- -----------------------------------------------------------------------------
ALTER TABLE stock_item
  ADD COLUMN available integer GENERATED ALWAYS AS (on_hand - reserved) STORED;

-- -----------------------------------------------------------------------------
-- 2. Invariant CHECK constraints — defense in depth. Even if application logic has
--    a bug, the DB refuses an impossible stock state.
-- -----------------------------------------------------------------------------
ALTER TABLE stock_item
  ADD CONSTRAINT stock_item_on_hand_nonneg  CHECK (on_hand >= 0),
  ADD CONSTRAINT stock_item_reserved_nonneg CHECK (reserved >= 0),
  ADD CONSTRAINT stock_item_reserved_le_on_hand CHECK (reserved <= on_hand);

-- A zero/negative reservation qty would let the guarded UPDATE (reserved = reserved
-- + qty) silently DECREMENT reserved under the guise of a normal reservation insert,
-- masking oversold inventory as available.
ALTER TABLE stock_reservation
  ADD CONSTRAINT stock_reservation_qty_positive CHECK (qty > 0);

-- -----------------------------------------------------------------------------
-- 3. updated_at triggers (reuses set_updated_at() from 0001_foundation_raw.sql).
--    stock_movement is intentionally excluded — it is append-only and immutable.
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouse', 'stock_item', 'stock_reservation'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Reservation lookups: partial index on ACTIVE reservations (the hot path for
--    every reserve/commit/release), and an expiry-sweep index for the BullMQ
--    sweeper job (plan/07 §3, plan/12 §5 — sweeper itself is scheduled in Stage 3).
-- -----------------------------------------------------------------------------
CREATE INDEX ix_stock_reservation_active
  ON stock_reservation (stock_item_id) WHERE status = 'ACTIVE';

CREATE INDEX ix_stock_reservation_expiry_sweep
  ON stock_reservation (expires_at) WHERE status = 'ACTIVE';

-- Supports "find the active reservation(s) for this cart/order" (plan/07 §3:
-- checkout-complete commit, order-cancelled release) once Order integration (Stage 8)
-- looks reservations up by ref instead of by their own publicId.
CREATE INDEX ix_stock_reservation_ref
  ON stock_reservation (ref_type, ref_id) WHERE status = 'ACTIVE';

-- -----------------------------------------------------------------------------
-- 5. Movement history: BRIN index on created_at (cheap, effective on an append-only,
--    naturally time-ordered table — see plan/00 §4.6). Upgrade to real partitioning
--    in Stage 6 when volume warrants it; BRIN remains useful even after that.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_stock_movement_created_at_brin
  ON stock_movement USING brin (created_at);

-- -----------------------------------------------------------------------------
-- 6. Low-stock lookups (plan/07 §5: low stock = available <= reorder_point). The
--    predicate matches the digest-job query directly (a NULL reorder_point makes the
--    comparison false automatically, so no separate IS NOT NULL guard is needed) and
--    membership updates automatically since `available` is a STORED generated column.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_stock_item_low_stock
  ON stock_item (warehouse_id)
  WHERE available <= reorder_point;

-- =============================================================================
-- End 0002_inventory_raw.sql
-- =============================================================================
