-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cgstAmount" DECIMAL(12,2),
ADD COLUMN "sgstAmount" DECIMAL(12,2),
ADD COLUMN "igstAmount" DECIMAL(12,2);
