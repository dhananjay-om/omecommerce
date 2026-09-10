CREATE TABLE "mega_menu_item" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "promo_image_media_key" TEXT,
    "promo_href" TEXT,
    "promo_caption" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "mega_menu_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mega_menu_item_public_id_key" ON "mega_menu_item"("public_id");
