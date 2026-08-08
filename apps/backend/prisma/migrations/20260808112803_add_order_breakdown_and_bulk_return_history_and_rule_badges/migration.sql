-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "subtotal" DECIMAL(12,2),
ADD COLUMN     "taxAmount" DECIMAL(12,2),
ADD COLUMN     "shippingAmount" DECIMAL(12,2),
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "roundOffAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "adminRemarks" TEXT;

-- AlterTable
ALTER TABLE "DynamicRule" ADD COLUMN     "badgeLabel" TEXT,
ADD COLUMN     "badgeColor" TEXT;

-- CreateTable
CREATE TABLE "BulkOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "bulkOrderId" TEXT NOT NULL,
    "status" "BulkOrderStatus" NOT NULL,
    "comment" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnStatusHistory" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "remarks" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkOrderStatusHistory_bulkOrderId_idx" ON "BulkOrderStatusHistory"("bulkOrderId");

-- CreateIndex
CREATE INDEX "ReturnStatusHistory_returnRequestId_idx" ON "ReturnStatusHistory"("returnRequestId");

-- AddForeignKey
ALTER TABLE "BulkOrderStatusHistory" ADD CONSTRAINT "BulkOrderStatusHistory_bulkOrderId_fkey" FOREIGN KEY ("bulkOrderId") REFERENCES "BulkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnStatusHistory" ADD CONSTRAINT "ReturnStatusHistory_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
