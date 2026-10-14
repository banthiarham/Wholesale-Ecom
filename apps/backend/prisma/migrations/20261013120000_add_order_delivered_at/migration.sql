ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- Existing delivered orders: best available delivery time is their last update.
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED';
