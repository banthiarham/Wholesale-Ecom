-- CreateTable
CREATE TABLE "SeasonalDiscount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minOrderValue" DECIMAL(12,2),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonalDiscount_productId_idx" ON "SeasonalDiscount"("productId");

-- CreateIndex
CREATE INDEX "SeasonalDiscount_categoryId_idx" ON "SeasonalDiscount"("categoryId");

-- CreateIndex
CREATE INDEX "SeasonalDiscount_isActive_idx" ON "SeasonalDiscount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX "ContractPrice_productId_idx" ON "ContractPrice"("productId");

-- CreateIndex
CREATE INDEX "ContractPrice_userId_idx" ON "ContractPrice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPrice_productId_userId_key" ON "ContractPrice"("productId", "userId");

-- AddForeignKey
ALTER TABLE "SeasonalDiscount" ADD CONSTRAINT "SeasonalDiscount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalDiscount" ADD CONSTRAINT "SeasonalDiscount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPrice" ADD CONSTRAINT "ContractPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPrice" ADD CONSTRAINT "ContractPrice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
