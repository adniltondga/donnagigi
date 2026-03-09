/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - Added the required column `salePrice` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "baseModel" TEXT,
ADD COLUMN     "boxCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "calculatedMargin" DOUBLE PRECISION,
ADD COLUMN     "colorVariant" TEXT,
ADD COLUMN     "deliveryTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "minStock" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "mlTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "salePrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "supplier" TEXT,
ALTER COLUMN "stock" SET DEFAULT 0;
