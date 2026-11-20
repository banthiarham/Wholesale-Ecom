ALTER TABLE "User" ADD COLUMN "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "openingBalanceDate" TIMESTAMP(3),
ADD COLUMN "openingBalanceNote" TEXT,
ADD COLUMN "openingBalanceUpdatedBy" TEXT,
ADD COLUMN "openingBalanceUpdatedAt" TIMESTAMP(3);
