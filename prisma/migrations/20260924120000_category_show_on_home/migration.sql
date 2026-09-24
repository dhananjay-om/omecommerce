-- Home page "Shop by Category" becomes an explicit per-category choice.
-- New categories default to NOT shown; existing root categories are backfilled
-- to shown so the live home page looks exactly the same right after deploy
-- (the admin then unticks the ones they don't want, e.g. an internal
-- "Home page" category).
ALTER TABLE "category" ADD COLUMN "show_on_home" BOOLEAN NOT NULL DEFAULT false;
UPDATE "category" SET "show_on_home" = true WHERE "parent_id" IS NULL AND "deleted_at" IS NULL;
