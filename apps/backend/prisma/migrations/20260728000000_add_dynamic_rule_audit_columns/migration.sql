-- AlterTable
ALTER TABLE "DynamicRule" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "DynamicRule" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;
