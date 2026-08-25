-- CreateTable
CREATE TABLE "product_forecast" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "date_key" INTEGER NOT NULL,
    "website_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "avg_daily_sell_rate" DECIMAL(10,4) NOT NULL,
    "trend_pct" DECIMAL(10,2),
    "current_stock" INTEGER NOT NULL,
    "days_of_cover" DECIMAL(10,2),
    "risk_tier" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_forecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_forecast_public_id_key" ON "product_forecast"("public_id");

-- CreateIndex
CREATE INDEX "product_forecast_website_id_date_key_idx" ON "product_forecast"("website_id", "date_key");

-- CreateIndex
CREATE INDEX "product_forecast_risk_tier_idx" ON "product_forecast"("risk_tier");

-- CreateIndex
CREATE UNIQUE INDEX "ux_product_forecast_date_website_product" ON "product_forecast"("date_key", "website_id", "product_id");
