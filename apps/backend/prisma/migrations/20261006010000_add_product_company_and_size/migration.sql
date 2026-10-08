-- Optional company name and size (in GB) on products
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sizeGb" DOUBLE PRECISION;
