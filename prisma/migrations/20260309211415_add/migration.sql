-- CreateTable
CREATE TABLE "MLIntegration" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "sellerID" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mlListingID" TEXT NOT NULL,
    "mlSKU" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "syncError" TEXT,
    "mlIntegrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MLProduct_mlListingID_key" ON "MLProduct"("mlListingID");

-- CreateIndex
CREATE UNIQUE INDEX "MLProduct_productId_mlIntegrationId_key" ON "MLProduct"("productId", "mlIntegrationId");

-- AddForeignKey
ALTER TABLE "MLProduct" ADD CONSTRAINT "MLProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLProduct" ADD CONSTRAINT "MLProduct_mlIntegrationId_fkey" FOREIGN KEY ("mlIntegrationId") REFERENCES "MLIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
