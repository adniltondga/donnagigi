/*
  Warnings:

  - You are about to drop the column `active` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `contactPerson` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp` on the `Supplier` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Supplier_code_key";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "active",
DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "code",
DROP COLUMN "contactPerson",
DROP COLUMN "email",
DROP COLUMN "notes",
DROP COLUMN "state",
DROP COLUMN "whatsapp",
ADD COLUMN     "telephone" TEXT;
