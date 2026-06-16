-- CreateTable
CREATE TABLE "BundleTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "images" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleGroup" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "minSelect" INTEGER NOT NULL DEFAULT 1,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" DECIMAL(12,2),
    "maxDiscount" DECIMAL(12,2),
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleGroupProduct" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BundleGroupProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleTemplate_status_idx" ON "BundleTemplate"("status");
CREATE UNIQUE INDEX "BundleTemplate_handle_key" ON "BundleTemplate"("handle");
CREATE INDEX "BundleTemplate_handle_idx" ON "BundleTemplate"("handle");

-- CreateIndex
CREATE INDEX "BundleGroup_bundleId_idx" ON "BundleGroup"("bundleId");
CREATE INDEX "BundleGroup_categoryId_idx" ON "BundleGroup"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleGroupProduct_groupId_productId_key" ON "BundleGroupProduct"("groupId", "productId");
CREATE INDEX "BundleGroupProduct_groupId_idx" ON "BundleGroupProduct"("groupId");
CREATE INDEX "BundleGroupProduct_productId_idx" ON "BundleGroupProduct"("productId");

-- AddForeignKey
ALTER TABLE "BundleGroup" ADD CONSTRAINT "BundleGroup_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "BundleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleGroup" ADD CONSTRAINT "BundleGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleGroupProduct" ADD CONSTRAINT "BundleGroupProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BundleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleGroupProduct" ADD CONSTRAINT "BundleGroupProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add bundleGroupId column to CartItem (nullable for standalone items)
ALTER TABLE "CartItem" ADD COLUMN "bundleGroupId" TEXT;

-- AddForeignKey for CartItem.bundleGroupId
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_bundleGroupId_fkey" FOREIGN KEY ("bundleGroupId") REFERENCES "BundleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique constraint and create new one
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_productId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_bundleGroupId_key" ON "CartItem"("cartId", "productId", "bundleGroupId");

-- CreateIndex for CartItem.bundleGroupId
CREATE INDEX "CartItem_bundleGroupId_idx" ON "CartItem"("bundleGroupId");