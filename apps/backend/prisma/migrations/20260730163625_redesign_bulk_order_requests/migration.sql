-- AlterEnum
BEGIN;
CREATE TYPE "BulkOrderStatus_new" AS ENUM ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'NEGOTIATION', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "BulkOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BulkOrder" ALTER COLUMN "status" TYPE "BulkOrderStatus_new" USING ("status"::text::"BulkOrderStatus_new");
ALTER TYPE "BulkOrderStatus" RENAME TO "BulkOrderStatus_old";
ALTER TYPE "BulkOrderStatus_new" RENAME TO "BulkOrderStatus";
DROP TYPE "BulkOrderStatus_old";
ALTER TABLE "BulkOrder" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "BulkOrder" DROP CONSTRAINT "BulkOrder_orderId_fkey";

-- DropForeignKey
ALTER TABLE "BulkOrder" DROP CONSTRAINT "BulkOrder_userId_fkey";

-- DropForeignKey
ALTER TABLE "BulkOrderItem" DROP CONSTRAINT "BulkOrderItem_bulkOrderId_fkey";

-- DropForeignKey
ALTER TABLE "BulkOrderItem" DROP CONSTRAINT "BulkOrderItem_productId_fkey";

-- DropIndex
DROP INDEX "BulkOrder_orderId_key";

-- AlterTable
ALTER TABLE "BulkOrder" DROP COLUMN "notes",
DROP COLUMN "orderId",
DROP COLUMN "shippingAddress",
DROP COLUMN "totalAmount",
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "budget" TEXT NOT NULL,
ADD COLUMN     "businessAddress" TEXT NOT NULL,
ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "contactPerson" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "mobileNumber" TEXT NOT NULL,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "products" TEXT NOT NULL,
ADD COLUMN     "quantity" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'NEW';

-- DropTable
DROP TABLE "BulkOrderItem";

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
