-- Invoice-letterhead branding for a website: a freeform print-only address
-- and a logo (stored as an S3 object key, resolved to bytes and base64-
-- embedded into the invoice HTML at generation time — see
-- src/modules/order/infrastructure/invoice-branding.ts). Both nullable with
-- no default expression needed and no CHECK constraint, so — same as
-- prices_include_tax before it — a plain ADD COLUMN only takes a brief
-- metadata-only lock; no NOT VALID/VALIDATE pattern required.
ALTER TABLE "website" ADD COLUMN "address" TEXT;
ALTER TABLE "website" ADD COLUMN "logo_media_key" TEXT;
