/**
 * Script: Download all Unsplash product images locally, resize with Sharp,
 * save to uploads/products, and update database via Prisma.
 *
 * Usage: cd apps/backend && npx ts-node scripts/download-product-images.ts
 *
 * Or: cd apps/backend && npx tsx scripts/download-product-images.ts
 */
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function processImage(url: string): Promise<string> {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const baseName = pathname.split('/').pop()?.replace(/\.[^.]+$/, '') || 'img';
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const outputFilename = `${uniqueName}.webp`;
  const outputPath = path.join(UPLOAD_DIR, outputFilename);

  try {
    const buffer = await downloadImage(url);
    await sharp(buffer)
      .resize(1200, 1200, { withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return `/uploads/products/${outputFilename}`;
  } catch (err) {
    console.error(`  Failed to download/resize ${url.slice(0, 60)}...:`, (err as Error).message);
    // Fallback: try without resize
    try {
      const buffer = await downloadImage(url);
      fs.writeFileSync(outputPath.replace('.webp', '.jpg'), buffer);
      return `/uploads/products/${uniqueName}.jpg`;
    } catch {
      console.error(`  Complete fallback failed for ${url.slice(0, 60)}`);
      return url; // Keep original URL as last resort
    }
  }
}

async function main() {
  console.log('📦 Starting product image download and resize...\n');

  const products = await prisma.product.findMany({
    select: { id: true, images: true, thumbnail: true }
  });

  console.log(`Found ${products.length} products\n`);

  // Build a URL → localPath cache so we don't download the same URL twice
  const urlCache = new Map<string, string>();
  let downloaded = 0;
  let failed = 0;

  for (const product of products) {
    console.log(`Processing product ${product.id}...`);

    const newImages: string[] = [];
    const oldImages: string[] = product.images as string[] || [];

    for (const imgUrl of oldImages) {
      if (!imgUrl || imgUrl.startsWith('/uploads/')) {
        // Already local or empty
        newImages.push(imgUrl);
        continue;
      }

      let localPath: string;
      if (urlCache.has(imgUrl)) {
        localPath = urlCache.get(imgUrl)!;
      } else {
        try {
          localPath = await processImage(imgUrl);
          urlCache.set(imgUrl, localPath);
          downloaded++;
          console.log(`  ✓ Downloaded [${downloaded}]: ${imgUrl.slice(0, 50)}... → ${localPath}`);
        } catch {
          localPath = imgUrl; // Keep original on failure
          failed++;
          urlCache.set(imgUrl, localPath);
        }
      }
      newImages.push(localPath);
    }

    // Update thumbnail
    let newThumbnail = product.thumbnail;
    if (newThumbnail && !newThumbnail.startsWith('/uploads/')) {
      if (urlCache.has(newThumbnail)) {
        newThumbnail = urlCache.get(newThumbnail)!;
      } else {
        // Thumbnail might be a different URL variant, try cache by base
        const matchingLocal = newImages.find((img, i) => {
          const origThumb = oldImages[i];
          return origThumb === newThumbnail && img.startsWith('/uploads/');
        });
        if (matchingLocal) {
          newThumbnail = matchingLocal;
        } else {
          try {
            newThumbnail = await processImage(newThumbnail);
            urlCache.set(product.thumbnail!, newThumbnail);
            downloaded++;
          } catch {
            failed++;
          }
        }
      }
    }

    // Update the product in database
    await prisma.product.update({
      where: { id: product.id },
      data: {
        images: newImages,
        thumbnail: newThumbnail,
      },
    });
  }

  console.log(`\n✅ Done! Downloaded: ${downloaded}, Failed: ${failed}`);
  console.log(`   Images saved to: ${UPLOAD_DIR}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});