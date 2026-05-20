-- AlterTable: marca vendas de troca (ML order com tag "change")
ALTER TABLE "Bill" ADD COLUMN "isExchange" BOOLEAN NOT NULL DEFAULT false;
