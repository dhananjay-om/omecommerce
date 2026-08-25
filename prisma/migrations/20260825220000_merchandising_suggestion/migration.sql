-- CreateTable
CREATE TABLE "merchandising_suggestion" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "headline" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "impact_score" DECIMAL(12,2) NOT NULL,
    "confidence" TEXT NOT NULL,
    "action_label" TEXT NOT NULL,
    "action_href" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchandising_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchandising_suggestion_public_id_key" ON "merchandising_suggestion"("public_id");

-- CreateIndex
CREATE INDEX "merchandising_suggestion_website_id_date_key_idx" ON "merchandising_suggestion"("website_id", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "ux_merch_suggestion_date_website_kind_target" ON "merchandising_suggestion"("date_key", "website_id", "kind", "target_type", "target_id");
