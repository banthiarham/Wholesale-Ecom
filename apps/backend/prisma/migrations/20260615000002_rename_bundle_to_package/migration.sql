-- Rename Bundle → Package: tables, columns, indexes, constraints

-- 1. Rename tables
ALTER TABLE "BundleTemplate" RENAME TO "PackageTemplate";
ALTER TABLE "BundleGroup" RENAME TO "PackageGroup";
ALTER TABLE "BundleGroupProduct" RENAME TO "PackageGroupProduct";

-- 2. Rename columns
ALTER TABLE "PackageGroup" RENAME COLUMN "bundleId" TO "packageId";
ALTER TABLE "CartItem" RENAME COLUMN "bundleGroupId" TO "packageGroupId";

-- 3. Rename primary key indexes
ALTER INDEX "BundleTemplate_pkey" RENAME TO "PackageTemplate_pkey";
ALTER INDEX "BundleGroup_pkey" RENAME TO "PackageGroup_pkey";
ALTER INDEX "BundleGroupProduct_pkey" RENAME TO "PackageGroupProduct_pkey";

-- 4. Rename unique/regular indexes
ALTER INDEX "BundleTemplate_handle_key" RENAME TO "PackageTemplate_handle_key";
ALTER INDEX "BundleTemplate_status_idx" RENAME TO "PackageTemplate_status_idx";
ALTER INDEX "BundleTemplate_handle_idx" RENAME TO "PackageTemplate_handle_idx";
ALTER INDEX "BundleGroup_bundleId_idx" RENAME TO "PackageGroup_packageId_idx";
ALTER INDEX "BundleGroup_categoryId_idx" RENAME TO "PackageGroup_categoryId_idx";
ALTER INDEX "BundleGroupProduct_groupId_idx" RENAME TO "PackageGroupProduct_groupId_idx";
ALTER INDEX "BundleGroupProduct_productId_idx" RENAME TO "PackageGroupProduct_productId_idx";
ALTER INDEX "CartItem_bundleGroupId_idx" RENAME TO "CartItem_packageGroupId_idx";

-- 5. Rename foreign key constraints (drop old, create new)
ALTER TABLE "PackageGroup" DROP CONSTRAINT "BundleGroup_bundleId_fkey";
ALTER TABLE "PackageGroup" ADD CONSTRAINT "PackageGroup_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "PackageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageGroup" DROP CONSTRAINT "BundleGroup_categoryId_fkey";
ALTER TABLE "PackageGroup" ADD CONSTRAINT "PackageGroup_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageGroupProduct" DROP CONSTRAINT "BundleGroupProduct_groupId_fkey";
ALTER TABLE "PackageGroupProduct" ADD CONSTRAINT "PackageGroupProduct_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "PackageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageGroupProduct" DROP CONSTRAINT "BundleGroupProduct_productId_fkey";
ALTER TABLE "PackageGroupProduct" ADD CONSTRAINT "PackageGroupProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_bundleGroupId_fkey";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_packageGroupId_fkey"
  FOREIGN KEY ("packageGroupId") REFERENCES "PackageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Rename unique constraint on CartItem (drop + recreate)
DROP INDEX "CartItem_cartId_productId_bundleGroupId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_packageGroupId_key"
  ON "CartItem"("cartId", "productId", "packageGroupId");