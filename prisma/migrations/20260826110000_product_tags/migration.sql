-- AlterTable
ALTER TABLE "product" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
