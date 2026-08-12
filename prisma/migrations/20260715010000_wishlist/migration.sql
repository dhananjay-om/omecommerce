-- CreateTable
CREATE TABLE "wishlist" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" BIGSERIAL NOT NULL,
    "wishlist_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_public_id_key" ON "wishlist"("public_id");

-- CreateIndex
CREATE INDEX "wishlist_customer_id_idx" ON "wishlist"("customer_id");

-- CreateIndex
CREATE INDEX "wishlist_item_product_id_idx" ON "wishlist_item"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_item_wishlist_id_product_id_key" ON "wishlist_item"("wishlist_id", "product_id");

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
