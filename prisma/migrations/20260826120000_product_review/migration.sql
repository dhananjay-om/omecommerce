-- CreateTable
CREATE TABLE "product_review" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" BIGINT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_product_review_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_review_public_id_key" ON "product_review"("public_id");

-- CreateIndex
CREATE INDEX "product_review_product_id_created_at_idx" ON "product_review"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
