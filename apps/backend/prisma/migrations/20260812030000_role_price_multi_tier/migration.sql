-- DropIndex
DROP INDEX IF EXISTS "RolePrice_productId_roleId_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RolePrice_productId_roleId_minQty_key" ON "RolePrice"("productId", "roleId", "minQty");
