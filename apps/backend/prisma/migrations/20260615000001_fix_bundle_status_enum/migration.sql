-- Fix: BundleTemplate.status was created as TEXT instead of the ProductStatus enum.
-- This caused Prisma enum queries to fail with "operator does not exist: text = ProductStatus".

-- Step 1: Drop the default (can't cast the default automatically)
ALTER TABLE "BundleTemplate" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Change column type from TEXT to ProductStatus enum
ALTER TABLE "BundleTemplate" ALTER COLUMN "status" TYPE "ProductStatus" USING "status"::"ProductStatus";

-- Step 3: Re-add the default using the proper enum type
ALTER TABLE "BundleTemplate" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ProductStatus";