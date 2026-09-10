-- Reports > Report Builder's "saved report" configurations. See
-- analytics.prisma's own doc comment on SavedReport for the "re-runnable
-- configuration, not a stored result snapshot" design.

CREATE TABLE "saved_report" (
    "id" BIGSERIAL PRIMARY KEY,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "metric_code" TEXT NOT NULL,
    "range_preset" TEXT NOT NULL,
    "custom_from_date_key" INTEGER,
    "custom_to_date_key" INTEGER,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "saved_report_public_id_key" ON "saved_report"("public_id");
