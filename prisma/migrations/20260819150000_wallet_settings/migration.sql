-- AlterTable
ALTER TABLE "website" ADD COLUMN     "wallet_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "wallet_max_amount_per_order" DECIMAL(18,4),
ADD COLUMN     "wallet_max_percent_of_order" DECIMAL(5,2),
ADD COLUMN     "wallet_min_order_value" DECIMAL(18,4);


-- Admin-configurable wallet-tender rules (plan/17) — see prisma/sql/0016_wallet_settings_raw.sql's own header comment for why the CHECKs use NOT VALID + VALIDATE CONSTRAINT.
-- Wallet tender admin-configurable rules (plan/17) — mirrors the app-level
-- validation in UpdateWebsiteWalletSettings as defense in depth, same
-- discipline as website_gstin_state_match etc. in earlier raw SQL files.
--
-- website is one of the hottest tables in the system (every request resolves
-- scope through it, plan/01 §1) — a plain ADD CONSTRAINT CHECK takes an
-- ACCESS EXCLUSIVE lock for the whole statement, which can queue up every
-- concurrent request against this table behind a slow validation scan.
-- NOT VALID + a separate VALIDATE CONSTRAINT (only a SHARE UPDATE EXCLUSIVE
-- lock) avoids that, same expand/migrate/contract doctrine 0015 already
-- established for cart_tender.

ALTER TABLE website
  ADD CONSTRAINT website_wallet_max_percent_of_order_range
  CHECK (wallet_max_percent_of_order IS NULL OR (wallet_max_percent_of_order > 0 AND wallet_max_percent_of_order <= 100))
  NOT VALID;
ALTER TABLE website VALIDATE CONSTRAINT website_wallet_max_percent_of_order_range;

ALTER TABLE website
  ADD CONSTRAINT website_wallet_min_order_value_nonneg
  CHECK (wallet_min_order_value IS NULL OR wallet_min_order_value >= 0)
  NOT VALID;
ALTER TABLE website VALIDATE CONSTRAINT website_wallet_min_order_value_nonneg;

ALTER TABLE website
  ADD CONSTRAINT website_wallet_max_amount_per_order_positive
  CHECK (wallet_max_amount_per_order IS NULL OR wallet_max_amount_per_order > 0)
  NOT VALID;
ALTER TABLE website VALIDATE CONSTRAINT website_wallet_max_amount_per_order_positive;
