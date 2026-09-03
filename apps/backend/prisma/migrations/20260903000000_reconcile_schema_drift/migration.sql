-- Reconciles the migration history with prisma/schema.prisma.
--
-- Several models were only ever applied to the development database with
-- `prisma db push` and never captured as migrations: Banner, HomeSection,
-- AuditLog, PaymentOffer and ShipmentSyncLog, plus enum and column changes on
-- existing tables, and the removal of the unused Catalog tables. A database
-- built from the migration history alone therefore did not match the schema
-- the Prisma client is generated from.
--
-- Generated with:
--   prisma migrate diff --from-migrations prisma/migrations \
--     --to-schema-datamodel prisma/schema.prisma --script

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('BANK', 'UPI');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'DEBIT', 'BOTH');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RefundStatus" ADD VALUE 'APPROVED';
ALTER TYPE "RefundStatus" ADD VALUE 'REJECTED';

-- DropForeignKey
ALTER TABLE "Catalog" DROP CONSTRAINT "Catalog_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogItem" DROP CONSTRAINT "CatalogItem_catalogId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogItem" DROP CONSTRAINT "CatalogItem_productId_fkey";

-- DropIndex
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "DeliveryPartner" ADD COLUMN     "apiBaseUrl" TEXT,
ADD COLUMN     "apiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "credentialFields" JSONB,
ADD COLUMN     "credentials" JSONB,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "webhookUrl" TEXT;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "type" "ReturnType" NOT NULL DEFAULT 'RETURN';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Catalog";

-- DropTable
DROP TABLE "CatalogItem";

-- DropEnum
DROP TYPE "CatalogStatus";

-- CreateTable
CREATE TABLE "PaymentOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offerType" "OfferType" NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "maxDiscount" DECIMAL(12,2),
    "minOrderValue" DECIMAL(12,2),
    "bankName" TEXT,
    "upiApp" TEXT,
    "cardType" "CardType" DEFAULT 'BOTH',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentSyncLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "buttonText" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "section" TEXT NOT NULL DEFAULT 'hero',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeSection" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "config" JSONB,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentOffer_productId_idx" ON "PaymentOffer"("productId");

-- CreateIndex
CREATE INDEX "PaymentOffer_categoryId_idx" ON "PaymentOffer"("categoryId");

-- CreateIndex
CREATE INDEX "PaymentOffer_isActive_idx" ON "PaymentOffer"("isActive");

-- CreateIndex
CREATE INDEX "PaymentOffer_offerType_idx" ON "PaymentOffer"("offerType");

-- CreateIndex
CREATE INDEX "PaymentOffer_bankName_idx" ON "PaymentOffer"("bankName");

-- CreateIndex
CREATE INDEX "PaymentOffer_upiApp_idx" ON "PaymentOffer"("upiApp");

-- CreateIndex
CREATE INDEX "ShipmentSyncLog_orderId_idx" ON "ShipmentSyncLog"("orderId");

-- CreateIndex
CREATE INDEX "ShipmentSyncLog_partnerId_idx" ON "ShipmentSyncLog"("partnerId");

-- CreateIndex
CREATE INDEX "ShipmentSyncLog_createdAt_idx" ON "ShipmentSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Banner_section_isActive_rank_idx" ON "Banner"("section", "isActive", "rank");

-- CreateIndex
CREATE INDEX "Banner_isActive_idx" ON "Banner"("isActive");

-- CreateIndex
CREATE INDEX "HomeSection_type_isActive_rank_idx" ON "HomeSection"("type", "isActive", "rank");

-- CreateIndex
CREATE INDEX "DeliveryPartner_apiEnabled_idx" ON "DeliveryPartner"("apiEnabled");

-- AddForeignKey
ALTER TABLE "PaymentOffer" ADD CONSTRAINT "PaymentOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOffer" ADD CONSTRAINT "PaymentOffer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentSyncLog" ADD CONSTRAINT "ShipmentSyncLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentSyncLog" ADD CONSTRAINT "ShipmentSyncLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "DynamicRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeSection" ADD CONSTRAINT "HomeSection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BundleGroupProduct_groupId_productId_key" RENAME TO "PackageGroupProduct_groupId_productId_key";

