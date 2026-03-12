-- First, rename 'image' to 'baseImage' in Product table
ALTER TABLE "Product" RENAME COLUMN "image" TO "baseImage";

-- Add sku column if it doesn't exist  
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;

-- Generate SKUs for products that don't have one
UPDATE "Product" SET "sku" = 'SKU-' || substring("id", 1, 8) WHERE "sku" IS NULL;

-- Make sku unique
ALTER TABLE "Product" ADD CONSTRAINT "Product_sku_unique" UNIQUE("sku");

-- Create ProductAttribute table
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE
);

-- Create unique index for ProductAttribute
CREATE UNIQUE INDEX "ProductAttribute_productId_name_key" ON "ProductAttribute"("productId", "name");

-- Create ProductAttributeValue table
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute" ("id") ON DELETE CASCADE
);

-- Create unique index for ProductAttributeValue
CREATE UNIQUE INDEX "ProductAttributeValue_attributeId_value_key" ON "ProductAttributeValue"("attributeId", "value");

-- Create ProductVariant table
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL UNIQUE,
    "image" TEXT,
    "purchaseCost" DOUBLE PRECISION,
    "boxCost" DOUBLE PRECISION,
    "mlTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "calculatedMargin" DOUBLE PRECISION,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "mlListed" BOOLEAN NOT NULL DEFAULT false,
    "mlListingId" TEXT,
    "mlListingUrl" TEXT,
    "shopeeListed" BOOLEAN NOT NULL DEFAULT false,
    "shopeeListingId" TEXT,
    "shopeeListingUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE
);

-- Create VariantAttributeValue table
CREATE TABLE "VariantAttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,
    CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE,
    CONSTRAINT "VariantAttributeValue_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "ProductAttributeValue" ("id") ON DELETE CASCADE
);

-- Create unique index for VariantAttributeValue
CREATE UNIQUE INDEX "VariantAttributeValue_variantId_attributeValueId_key" ON "VariantAttributeValue"("variantId", "attributeValueId");

-- Migrate existing products to variants
-- For each existing product, create a variant with its data
INSERT INTO "ProductVariant" ("id", "productId", "sku", "image", "purchaseCost", "boxCost", "mlTariff", "deliveryTariff", "salePrice", "calculatedMargin", "stock", "mlListed", "mlListingId", "mlListingUrl", "shopeeListed", "shopeeListingId", "shopeeListingUrl", "active", "createdAt", "updatedAt")
SELECT 
    'var_' || "id" as "id",
    "id" as "productId",
    "sku",
    "baseImage" as "image",
    COALESCE("purchaseCost", 0),
    COALESCE("boxCost", 0),
    COALESCE("mlTariff", 0),
    COALESCE("deliveryTariff", 0),
    "salePrice",
   "calculatedMargin",
    COALESCE("stock", 0),
    COALESCE("mlListed", false),
    "mlListingId",
    "mlListingUrl",
    COALESCE("shopeeListed", false),
    "shopeeListingId",
    "shopeeListingUrl",
    true,
    "createdAt",
    "updatedAt"
FROM "Product";

-- Create temp table to map old product IDs to new variant IDs
CREATE TEMP TABLE product_to_variant AS
SELECT p."id" as product_id, pv."id" as variant_id
FROM "Product" p
LEFT JOIN "ProductVariant" pv ON pv."productId" = p."id";

-- Update OrderItem to use variants
UPDATE "OrderItem" oi
SET "productId" = ptv.variant_id
FROM product_to_variant ptv
WHERE oi."productId" = ptv.product_id;

-- Rename productId to variantId in OrderItem
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" RENAME COLUMN "productId" TO "variantId";
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id");
DROP INDEX "OrderItem_orderId_productId_key";
CREATE UNIQUE INDEX "OrderItem_orderId_variantId_key" ON "OrderItem"("orderId", "variantId");

-- Update MLProduct to use variants
UPDATE "MLProduct" mp
SET "productId" = ptv.variant_id
FROM product_to_variant ptv
WHERE mp."productId" = ptv.product_id;

-- Rename productId to variantId in MLProduct
ALTER TABLE "MLProduct" DROP CONSTRAINT "MLProduct_productId_fkey";
ALTER TABLE "MLProduct" RENAME COLUMN "productId" TO "variantId";
ALTER TABLE "MLProduct" ADD CONSTRAINT "MLProduct_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE;
DROP INDEX "MLProduct_productId_mlIntegrationId_key";
CREATE UNIQUE INDEX "MLProduct_variantId_mlIntegrationId_key" ON "MLProduct"("variantId", "mlIntegrationId");

-- Clean up old columns from Product table
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_unique";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "baseModel";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "colorVariant";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "sku";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "purchaseCost";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "boxCost";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "mlTariff";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "deliveryTariff";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "salePrice";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "calculatedMargin";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "stock";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "mlListed";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "mlListingId";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "mlListingUrl";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "shopeeListed";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "shopeeListingId";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "shopeeListingUrl";

-- Add new columns to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "baseSalePrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "basePurchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "baseBoxCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- Create indexes on ProductVariant
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");


