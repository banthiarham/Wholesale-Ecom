import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: any) {
    const where: any = {};
    if (filters?.status) {
      const statuses = filters.status.split(',').map((s: string) => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    } else {
      where.status = 'PUBLISHED';
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.vendorId) where.vendorId = filters.vendorId;
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.unitPrice = {};
      if (filters.minPrice !== undefined) where.unitPrice.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.unitPrice.lte = filters.maxPrice;
    }
    if (filters?.inStock) where.inventoryQuantity = { gt: 0 };
    if (filters?.tags?.length) where.tags = { hasSome: filters.tags };

    // If specific IDs are requested, fetch only those (preserving order)
    if (filters?.ids?.length) {
      where.id = { in: filters.ids };
      const products = await this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, handle: true } },
          tierPrices: { orderBy: { minQty: 'asc' } },
          _count: { select: { reviews: true } },
        },
      });
      // Preserve the requested order
      const orderMap = new Map<string, number>(filters.ids.map((id: string, i: number) => [id, i]));
      return products.sort((a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }

    // Sort order
    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sort === 'popularity') orderBy = { rating: 'desc' };
    else if (filters?.sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (filters?.sort === 'price_asc') orderBy = { unitPrice: 'asc' };
    else if (filters?.sort === 'price_desc') orderBy = { unitPrice: 'desc' };

    const take = filters?.limit || 100;

    return this.prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, handle: true } },
        tierPrices: { orderBy: { minQty: 'asc' } },
        _count: { select: { reviews: true } },
      },
      orderBy,
      take,
    });
  }

  async findByHandle(handle: string) {
    const product = await this.prisma.product.findUnique({
      where: { handle },
      include: {
        category: { select: { id: true, name: true, handle: true } },
        tierPrices: { orderBy: { minQty: 'asc' } },
        reviews: {
          where: { isVerified: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        tierPrices: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: any) {
    const { tierPrices, ...rest } = data;
    return this.prisma.product.create({
      data: {
        ...rest,
        tierPrices: tierPrices ? { create: tierPrices } : undefined,
      },
      include: { category: true, tierPrices: true },
    });
  }

  async update(id: string, data: any) {
    const { tierPrices, ...rest } = data;
    if (tierPrices) {
      await this.prisma.tierPrice.deleteMany({ where: { productId: id } });
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        tierPrices: tierPrices ? { create: tierPrices } : undefined,
      },
      include: { category: true, tierPrices: true },
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.orderItem.deleteMany({ where: { productId: id } });
      await tx.review.deleteMany({ where: { productId: id } });
      await tx.rfqItem.deleteMany({ where: { productId: id } });
      await tx.stockAdjustment.deleteMany({ where: { productId: id } });
      await tx.inventoryLog.deleteMany({ where: { productId: id } });
      await tx.contractPrice.deleteMany({ where: { productId: id } });
      await tx.seasonalDiscount.deleteMany({ where: { productId: id } });
      await tx.tierPrice.deleteMany({ where: { productId: id } });
      return tx.product.delete({ where: { id } });
    });
  }

  async addImages(id: string, urls: string[]) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const existing = (product.images as string[]) || [];
    const updated = [...existing, ...urls];
    const data: any = { images: updated };
    if (!product.thumbnail && updated.length > 0) {
      data.thumbnail = updated[0];
    }
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, tierPrices: true },
    });
  }

  private async downloadImageToDisk(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      const timeout = 10000;
      let chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB

      const req = client.get(url, { timeout }, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.downloadImageToDisk(redirectUrl).then(resolve);
            return;
          }
        }
        if (res.statusCode !== 200) { resolve(null); return; }
        const contentType = res.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) { resolve(null); return; }

        res.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > MAX_SIZE) { req.destroy(); resolve(null); return; }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const dir = path.join(process.cwd(), 'uploads', 'products');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            fs.writeFileSync(path.join(dir, filename), buffer);
            resolve(`/uploads/products/${filename}`);
          } catch { resolve(null); }
        });
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  async bulkUploadFromExcel(
    buffer: Buffer,
    imageFiles: Express.Multer.File[] = [],
    imageMapping: Record<string, string> = {},
  ) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty or has no data rows');
    }

    const results = { created: 0, updated: 0, errors: [] as string[], imageErrors: [] as string[], imagesDownloaded: 0, imagesUploaded: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const sku = (row.sku || row.SKU || '').toString().trim();
        const title = (row.title || row.Title || row.name || row.Name || '').toString().trim();
        const unitPrice = parseFloat(row.unitPrice || row.UnitPrice || row.price || row.Price || '0');
        const moq = parseInt(row.moq || row.MOQ || row.minQty || row.MinQty || '1', 10);
        const inventoryQuantity = parseInt(row.inventoryQuantity || row.InventoryQuantity || row.stock || row.Stock || row.qty || '0', 10);
        const description = (row.description || row.Description || '').toString().trim();
        const status = (row.status || row.Status || 'PUBLISHED').toString().trim().toUpperCase();
        const vendorName = (row.vendorName || row.VendorName || '').toString().trim();
        const categoryId = (row.categoryId || row.CategoryId || '').toString().trim();
        const tagsStr = (row.tags || row.Tags || '').toString().trim();
        const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        const compareAtPrice = parseFloat(row.compareAtPrice || row.CompareAtPrice || '0') || null;
        const imagesStr = (row.images || row.Images || row.imageUrls || row.ImageUrls || '').toString().trim();
        const imageUrlList = imagesStr ? imagesStr.split(',').map((u: string) => u.trim()).filter(Boolean) : [];

        if (!sku || !title || !unitPrice) {
          results.errors.push(`Row ${i + 2}: Missing required fields (sku, title, unitPrice)`);
          continue;
        }

        // Check if product with this SKU already exists
        const existing = await this.prisma.product.findUnique({ where: { sku } });
        let productId: string;

        if (existing) {
          // Update existing product
          const updateData: any = {
            title: title || existing.title,
            unitPrice: unitPrice || existing.unitPrice,
            moq: moq > 0 ? moq : existing.moq,
            inventoryQuantity: inventoryQuantity || existing.inventoryQuantity,
          };
          if (description) updateData.description = description;
          if (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) updateData.status = status;
          if (vendorName) updateData.vendorName = vendorName;
          if (categoryId) updateData.categoryId = categoryId;
          if (tags.length > 0) updateData.tags = tags;
          if (compareAtPrice) updateData.compareAtPrice = compareAtPrice;

          await this.prisma.product.update({
            where: { id: existing.id },
            data: updateData,
          });
          productId = existing.id;
          results.updated++;
        } else {
          // Create new product — generate handle from title
          const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

          const newProduct = await this.prisma.product.create({
            data: {
              title,
              handle,
              sku,
              unitPrice,
              compareAtPrice,
              moq: moq > 0 ? moq : 1,
              inventoryQuantity: inventoryQuantity || 0,
              description: description || null,
              status: ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED',
              vendorName: vendorName || null,
              categoryId: categoryId || null,
              tags,
            },
          });
          productId = newProduct.id;
          results.created++;
        }

        // Process images for this product
        const localImageUrls: string[] = [];

        // 1) Download image URLs from Excel column
        for (const url of imageUrlList) {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const localUrl = await this.downloadImageToDisk(url);
            if (localUrl) {
              localImageUrls.push(localUrl);
              results.imagesDownloaded++;
            } else {
              results.imageErrors.push(`Row ${i + 2}: Failed to download image: ${url}`);
            }
          } else if (url.startsWith('/uploads/')) {
            localImageUrls.push(url);
          }
        }

        // 2) Save locally-uploaded image files matched by SKU
        const skuMatchedFiles = imageFiles.filter(
          (f) => imageMapping[f.originalname] === sku,
        );
        for (const f of skuMatchedFiles) {
          const ext = path.extname(f.originalname) || '.jpg';
          const dir = path.join(process.cwd(), 'uploads', 'products');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          fs.writeFileSync(path.join(dir, filename), f.buffer);
          localImageUrls.push(`/uploads/products/${filename}`);
          results.imagesUploaded++;
        }

        // Attach images to product (max 5)
        if (localImageUrls.length > 0) {
          const toAdd = localImageUrls.slice(0, 5);
          if (localImageUrls.length > 5) {
            results.imageErrors.push(`Row ${i + 2}: Only first 5 images added for SKU ${sku} (${localImageUrls.length} provided)`);
          }
          await this.addImages(productId, toAdd);
        }
      } catch (err) {
        results.errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    // Report unmatched local image files
    const matchedFilenames = new Set(
      imageFiles.filter((f) => imageMapping[f.originalname]).map((f) => f.originalname),
    );
    for (const f of imageFiles) {
      if (!matchedFilenames.has(f.originalname)) {
        results.imageErrors.push(`Unmatched image file: ${f.originalname} — no matching SKU found in Excel`);
      }
    }

    return results;
  }

  async bulkUpdateFromExcel(buffer: Buffer): Promise<{ updated: number; errors: string[] }> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or has no data rows');
    }

    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const id = String(row.id || row.ID || '').trim();
        const sku = String(row.sku || row.SKU || '').trim();

        if (!id && !sku) {
          errors.push(`Row ${i + 2}: No id or sku provided`);
          continue;
        }

        // Find existing product by id (preferred) or sku
        let product: any;
        if (id) {
          product = await this.prisma.product.findUnique({ where: { id } });
        }
        if (!product && sku) {
          product = await this.prisma.product.findUnique({ where: { sku } });
        }

        if (!product) {
          errors.push(`Row ${i + 2}: Product not found (${id || sku})`);
          continue;
        }

        const data: Record<string, any> = {};
        const unitPrice = row.unitPrice !== undefined && row.unitPrice !== '' ? Number(row.unitPrice) : undefined;
        const compareAtPrice = row.compareAtPrice !== undefined && row.compareAtPrice !== '' ? Number(row.compareAtPrice) : undefined;
        const moq = row.moq !== undefined && row.moq !== '' ? Number(row.moq) : undefined;
        const inventoryQuantity = row.inventoryQuantity !== undefined && row.inventoryQuantity !== '' ? Number(row.inventoryQuantity) : undefined;
        const status = (row.status || row.Status || '').toString().trim().toUpperCase();

        if (unitPrice !== undefined && !isNaN(unitPrice)) data.unitPrice = unitPrice;
        if (compareAtPrice !== undefined && !isNaN(compareAtPrice)) data.compareAtPrice = compareAtPrice;
        if (moq !== undefined && !isNaN(moq) && moq > 0) data.moq = moq;
        if (inventoryQuantity !== undefined && !isNaN(inventoryQuantity)) data.inventoryQuantity = inventoryQuantity;
        if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) data.status = status;

        if (Object.keys(data).length === 0) continue; // No changes for this row

        await this.prisma.product.update({ where: { id: product.id }, data });
        updated++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
      }
    }

    return { updated, errors };
  }
}
