-- System > Users: track when an admin user last logged in.
-- Safe additive column — every existing row gets NULL ("never logged in
-- since this column existed"), Login.execute() sets it going forward.

ALTER TABLE "admin_user"
  ADD COLUMN "last_login_at" TIMESTAMPTZ(6);
