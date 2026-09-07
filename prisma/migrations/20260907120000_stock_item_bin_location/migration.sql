-- Pick & Pack (Fulfillment feature area): an optional, admin-set free-text
-- warehouse location per (variant, warehouse) stock row. Nullable — a real
-- pick list still works for stock with no location set, it just can't sort
-- or group by one.
ALTER TABLE "stock_item" ADD COLUMN "bin_location" TEXT;
