-- The BulkOrder table, BulkOrderItem table and BulkOrderStatus enum were never
-- created by a migration; they existed in the development database only via
-- `prisma db push`. The original version of this migration ALTERed them into
-- the redesigned shape, which fails on any database built from the migration
-- history alone. It has been rewritten to create BulkOrder directly in the
-- shape the schema defines, so a fresh database ends up identical to one that
-- followed the db-push history.

-- CreateEnum
CREATE TYPE "BulkOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "BulkOrder" (
    "id" TEXT NOT NULL,
    "bulkOrderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "status" "BulkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "adminComment" TEXT,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "gstNumber" TEXT,
    "businessAddress" TEXT NOT NULL,
    "productId" TEXT,
    "products" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkOrder_bulkOrderNumber_key" ON "BulkOrder"("bulkOrderNumber");

-- CreateIndex
CREATE INDEX "BulkOrder_userId_idx" ON "BulkOrder"("userId");

-- CreateIndex
CREATE INDEX "BulkOrder_status_idx" ON "BulkOrder"("status");

-- CreateIndex
CREATE INDEX "BulkOrder_bulkOrderNumber_idx" ON "BulkOrder"("bulkOrderNumber");

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
