-- Store contact email for admin "General" settings (see store.prisma's
-- Website.supportEmail doc comment) — nullable, no default, no CHECK, so a
-- plain ADD COLUMN only takes a brief metadata-only lock, same reasoning as
-- the address/logo_media_key columns added just before this one.
ALTER TABLE "website" ADD COLUMN "support_email" VARCHAR(255);
