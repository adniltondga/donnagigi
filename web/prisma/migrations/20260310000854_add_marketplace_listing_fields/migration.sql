-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "mlListed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mlListingId" TEXT,
ADD COLUMN     "mlListingUrl" TEXT,
ADD COLUMN     "shopeeListed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shopeeListingId" TEXT,
ADD COLUMN     "shopeeListingUrl" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
