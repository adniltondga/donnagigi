-- AlterTable
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "sku",
ADD COLUMN "cod" TEXT NOT NULL,
ADD CONSTRAINT "ProductVariant_cod_key" UNIQUE ("cod");
