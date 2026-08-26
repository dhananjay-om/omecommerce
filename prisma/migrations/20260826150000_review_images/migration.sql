-- AlterTable
ALTER TABLE "product_review" ADD COLUMN     "image_keys" TEXT[] DEFAULT ARRAY[]::TEXT[];
