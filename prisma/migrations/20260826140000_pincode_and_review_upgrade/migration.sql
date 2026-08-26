-- AlterTable: real review submission (customer link + moderation flag)
ALTER TABLE "product_review" ADD COLUMN     "customer_id" BIGINT,
ADD COLUMN     "is_approved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_review_product_id_is_approved_idx" ON "product_review"("product_id", "is_approved");

-- AddForeignKey
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: admin-curated pincode serviceability lookup
CREATE TABLE "serviceable_pincode" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT uuidv7(),
    "code" VARCHAR(6) NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "estimated_days" INTEGER NOT NULL,
    "cod_available" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,

    CONSTRAINT "serviceable_pincode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "serviceable_pincode_public_id_key" ON "serviceable_pincode"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "serviceable_pincode_code_key" ON "serviceable_pincode"("code");
