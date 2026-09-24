-- Newsletter subscribers (storefront sign-up forms + admin list/export).
CREATE TYPE "NewsletterStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

CREATE TABLE "newsletter_subscriber" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "source" TEXT NOT NULL DEFAULT 'home',
    "website_code" TEXT,
    "unsubscribe_token" TEXT NOT NULL,
    "subscribed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscriber_public_id_key" ON "newsletter_subscriber"("public_id");
CREATE UNIQUE INDEX "newsletter_subscriber_email_key" ON "newsletter_subscriber"("email");
CREATE UNIQUE INDEX "newsletter_subscriber_unsubscribe_token_key" ON "newsletter_subscriber"("unsubscribe_token");
CREATE INDEX "newsletter_subscriber_status_subscribed_at_idx" ON "newsletter_subscriber"("status", "subscribed_at");
