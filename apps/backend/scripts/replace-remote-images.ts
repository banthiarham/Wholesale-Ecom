/**
 * Script: Replace all remaining remote Unsplash URLs in the database
 * with random local images from uploads/products/.
 * Unsplash URLs are all returning 404, so we assign existing local images instead.
 *
 * Usage: cd apps/backend && npx tsx scripts/replace-remote-images.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

async function main() {
  console.log('🔄 Replacing remote Unsplash URLs with local images...\n');

  // Get all available local image files
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg'));
  console.log(`Found ${files.length} local image files in uploads/products/`);

  if (files.length === 0) {
    console.error('No local images available!');
    process.exit(1);
  }

  // Get all products
  const products = await prisma.product.findMany({
    select: { id: true, images: true, thumbnail: true }
  });

  console.log(`Found ${products.length} products\n`);

  let updatedCount = 0;
  let totalReplacements = 0;

  for (const product of products) {
    const oldImages: string[] = (product.images as string[]) || [];
    let needsUpdate = false;

    // Replace remote URLs in images array
    const newImages = oldImages.map(img => {
      if (img.startsWith('http')) {
        needsUpdate = true;
        totalReplacements++;
        const randomFile = files[Math.floor(Math.random() * files.length)];
        return `/uploads/products/${randomFile}`;
      }
      return img;
    });

    // Replace remote URL in thumbnail
    let newThumbnail = product.thumbnail;
    if (newThumbnail && newThumbnail.startsWith('http')) {
      needsUpdate = true;
      totalReplacements++;
      const randomFile = files[Math.floor(Math.random() * files.length)];
      newThumbnail = `/uploads/products/${randomFile}`;
    }

    // Also ensure thumbnail uses first image if thumbnail is null but images exist
    if (!newThumbnail && newImages.length > 0) {
      needsUpdate = true;
      newThumbnail = newImages[0];
    }

    if (needsUpdate) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          images: newImages,
          thumbnail: newThumbnail,
        },
      });
      updatedCount++;
      console.log(`  ✓ Updated product ${product.id} (${newImages.filter(i => i.startsWith('/uploads/')).length}/${newImages.length} local)`);
    }
  }

  console.log(`\n✅ Done! Updated ${updatedCount} products, replaced ${totalReplacements} remote URLs`);

  // Verify no remote URLs remain
  const remaining = await prisma.product.findMany({
    select: { id: true, images: true, thumbnail: true }
  });
  let remainingRemote = 0;
  remaining.forEach(p => {
    (p.images as string[] || []).forEach(img => { if (img.startsWith('http')) remainingRemote++; });
    if (p.thumbnail && p.thumbnail.startsWith('http')) remainingRemote++;
  });

  if (remainingRemote === 0) {
    console.log('🎉 All product images are now local!');
  } else {
    console.log(`⚠️  ${remainingRemote} remote URLs still remain`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});