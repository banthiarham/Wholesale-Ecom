-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A variant that already had a single image keeps it as the first (and only) image of its gallery.
UPDATE "ProductVariant" SET "images" = ARRAY["image"] WHERE "image" IS NOT NULL;
