-- CreateTable
CREATE TABLE "ai_insight" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "action_label" TEXT NOT NULL,
    "action_href" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_insight_public_id_key" ON "ai_insight"("public_id");

-- CreateIndex
CREATE INDEX "ai_insight_website_id_date_key_idx" ON "ai_insight"("website_id", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ai_insight_date_website_rule" ON "ai_insight"("date_key", "website_id", "rule_code");
