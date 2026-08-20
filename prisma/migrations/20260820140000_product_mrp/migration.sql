-- Migration: product_mrp
-- "MRP" / compare-at price: a nullable, purely additive display field on top of
-- the existing charged/taxed/totaled `price`/`unit_price` columns — never part of
-- any calculation, only a strikethrough + "X% off" when mrp > price. Added to
-- product_price (base retail price) and order_line (checkout-time snapshot);
-- deliberately NOT added to price_tier (wholesale/qty-tier pricing has no
-- "compare at" concept of its own — see ProductPrice.mrp's schema doc comment).
-- Hand-authored following this project's established self-contained-migration
-- shape, matching e.g. 20260820130000_payment_methods/migration.sql. CHECK
-- constraints follow the existing nonneg-CHECK convention (prisma/sql/0003_
-- pricing_raw.sql, 0004_order_raw.sql) plus a same-row "mrp must be the higher
-- of the two, when both present" guard, same shape as price_list_date_window's
-- two-column CHECK in 0003_pricing_raw.sql.

-- AlterTable
ALTER TABLE "product_price" ADD COLUMN "mrp" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "order_line" ADD COLUMN "mrp" DECIMAL(18,4);

-- CHECKs
ALTER TABLE "product_price"
  ADD CONSTRAINT product_price_mrp_nonneg CHECK (mrp IS NULL OR mrp >= 0),
  ADD CONSTRAINT product_price_mrp_ge_price CHECK (mrp IS NULL OR mrp >= price);

ALTER TABLE "order_line"
  ADD CONSTRAINT order_line_mrp_nonneg CHECK (mrp IS NULL OR mrp >= 0),
  ADD CONSTRAINT order_line_mrp_ge_unit_price CHECK (mrp IS NULL OR mrp >= unit_price);
