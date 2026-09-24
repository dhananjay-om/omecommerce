-- Storefront top bar settings, one row per website.
CREATE TABLE "top_bar_setting" (
    "id" BIGSERIAL NOT NULL,
    "website_id" BIGINT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "show_store_switcher" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "message" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" BIGINT,

    CONSTRAINT "top_bar_setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "top_bar_setting_website_id_key" ON "top_bar_setting"("website_id");
ALTER TABLE "top_bar_setting" ADD CONSTRAINT "top_bar_setting_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
