-- =============================================================================
-- 0007_wishlist_raw.sql
-- Raw-SQL blocks for storefront Wishlists (plan/05 §2.6). Appended after the
-- Prisma-generated DDL for wishlist/wishlist_item. Reuses set_updated_at()
-- from 0001_foundation_raw.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. wishlist.customer_id FK (bare scalar in Prisma, scope-column convention).
--    ON DELETE CASCADE, not SET NULL — the column is NOT NULL (unlike Cart's
--    nullable customer_id), so SET NULL is illegal; CASCADE is correct since a
--    wishlist has no independent value once its owning account is gone. NOT
--    RESTRICT — that would block deleting any customer who ever created a
--    wishlist, a near-guaranteed operational footgun.
-- -----------------------------------------------------------------------------
ALTER TABLE wishlist
  ADD CONSTRAINT wishlist_customer_id_fk FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 1. updated_at trigger — wishlist only (wishlist_item has no updated_at; it's
--    an insert/delete-only join row, same as cart_line).
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_at ON wishlist;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON wishlist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
