import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import sharp from 'sharp';

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

  private async downloadImageToDisk(url: string, redirectsLeft = 5): Promise<string | null> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      const timeout = 10000;
      let chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB

      // Many image hosts/CDNs reject requests with no User-Agent (or Node's
      // default one) with a 403, which otherwise silently drops the image.
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      };

      const req = client.get(url, { timeout, headers }, (res) => {
        // Follow redirects (resolving relative Location headers against the current URL)
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
          const location = res.headers.location;
          res.resume();
          if (location && redirectsLeft > 0) {
            try {
              const redirectUrl = new URL(location, url).toString();
              this.downloadImageToDisk(redirectUrl, redirectsLeft - 1).then(resolve);
            } catch {
              resolve(null);
            }
            return;
          }
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
        // Many real-world hosts mis-set or omit Content-Type for image files (most
        // commonly newer formats like .avif on servers whose MIME map predates them —
        // e.g. serving genuine image bytes as "text/plain"). Content-Type alone is
        // therefore not trustworthy; we only use it here to reject the one case it's
        // reliable for — an actual HTML page (a soft-404/error page, or a redirect
        // target that isn't really an image). Everything else is let through to the
        // byte-signature check below, which verifies the real file content.
        const contentType = (res.headers['content-type'] || '').toLowerCase();
        const looksLikeImageExt = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url);
        if (contentType.startsWith('text/html') || (!contentType.startsWith('image/') && !looksLikeImageExt)) {
          res.resume();
          resolve(null);
          return;
        }

        res.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > MAX_SIZE) { req.destroy(); resolve(null); return; }
          chunks.push(chunk);
        });
        res.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          // Authoritative check: does the downloaded content actually start with a
          // known image file signature? This catches soft-404 pages and other
          // non-image responses that slipped past the Content-Type check above.
          if (!this.looksLikeImageBytes(buffer)) { resolve(null); return; }
          const dir = path.join(process.cwd(), 'uploads', 'products');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          try {
            const filename = `${base}.webp`;
            // Resize and convert to WebP
            await sharp(buffer)
              .resize(1200, null, { withoutEnlargement: true, fit: 'inside' })
              .webp({ quality: 80 })
              .toFile(path.join(dir, filename));
            resolve(`/uploads/products/${filename}`);
          } catch {
            // Fallback: if sharp can't process this image, save the downloaded bytes
            // as-is instead of dropping the image — mirrors the fallback already used
            // for locally-uploaded bulk-import files and the manual single-upload path.
            try {
              const extMatch = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(?:\?|#|$)/i.exec(url);
              const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
              const filename = `${base}.${ext}`;
              fs.writeFileSync(path.join(dir, filename), buffer);
              resolve(`/uploads/products/${filename}`);
            } catch {
              resolve(null);
            }
          }
        });
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Resolves a category by name (case-insensitive, trimmed), creating it if it
   * doesn't exist yet. `cache` and `createdNames` are shared across rows in a
   * single import so the same new category name is only created once.
   */
  private async resolveCategoryIdByName(
    rawName: string,
    cache: Map<string, string>,
    createdNames: string[],
  ): Promise<string> {
    const name = rawName.trim();
    const key = name.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    let category = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (!category) {
      const baseHandle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'category';
      let handle = baseHandle;
      let suffix = 1;
      while (await this.prisma.category.findUnique({ where: { handle } })) {
        handle = `${baseHandle}-${suffix++}`;
      }
      category = await this.prisma.category.create({ data: { name, handle } });
      createdNames.push(category.name);
    }

    cache.set(key, category.id);
    return category.id;
  }

  // Collapses a header string down to just its letters/digits (lowercased) so that
  // casing, spacing, underscores, hyphens, and other punctuation differences between
  // a user's own Excel export and our expected column names ("Unit Price" vs
  // "unitPrice" vs "unit_price" vs " UNITPRICE ") all resolve to the same key.
  private normalizeHeaderKey(key: string): string {
    return key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Re-keys a parsed Excel row by normalized header name, so callers can look a
  // value up by any casing/spacing variant of a column name without needing an
  // ever-growing list of exact `row.foo || row.Foo || row['Foo Bar']` fallbacks.
  private normalizeRowKeys(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[this.normalizeHeaderKey(key)] = value;
    }
    return normalized;
  }

  // Looks up the first non-empty value among candidate column names (any of which
  // may use different casing/spacing) in an already-normalized row.
  private getField(normalizedRow: Record<string, any>, ...candidates: string[]): string {
    for (const candidate of candidates) {
      const value = normalizedRow[this.normalizeHeaderKey(candidate)];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  // Real-world Excel exports often store prices/quantities as text with currency
  // symbols and thousands separators ("₹1,299.00", "Rs. 499") rather than plain
  // numbers. `parseFloat` gives up at the first non-numeric character, so "₹499"
  // becomes NaN (wrongly read as "missing") and "1,299" becomes 1 (silently
  // wrong). Rather than stripping non-numeric characters (which would misread the
  // "." in an abbreviation like "Rs." as a decimal point — "Rs. 899" -> "0.899"),
  // this extracts the first proper number-shaped substring after removing
  // thousands-separator commas, so stray currency text around it is ignored.
  private parseNumericField(raw: string): number {
    if (!raw) return NaN;
    const match = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
  }

  // Sniffs the actual downloaded bytes for a known image file signature, rather
  // than trusting the HTTP Content-Type header (which real-world hosts frequently
  // get wrong — e.g. serving genuine .avif files as "text/plain" when the server's
  // MIME map doesn't know that extension). This is the authoritative check for
  // "is this actually image data", independent of what the server claimed.
  private looksLikeImageBytes(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true; // PNG
    if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return true; // GIF
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true; // BMP
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true; // WEBP
    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true; // AVIF/HEIC/ISO-BMFF family
    const head = buffer.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
    if (head.startsWith('<svg') || head.startsWith('<?xml')) return true; // SVG
    return false;
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

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      categoriesCreated: [] as string[],
      errors: [] as string[],
      imageErrors: [] as string[],
      imagesDownloaded: 0,
      imagesUploaded: 0,
    };
    const categoryCache = new Map<string, string>(); // lowercase, trimmed name -> category id

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Ignore completely empty rows instead of reporting them as failures
      const isEmptyRow = Object.values(row).every(
        (v) => v === undefined || v === null || String(v).trim() === '',
      );
      if (isEmptyRow) {
        results.skipped++;
        continue;
      }

      try {
        const r = this.normalizeRowKeys(row);
        const sku = this.getField(r, 'sku', 'skuCode', 'itemCode', 'productCode');
        const title = this.getField(r, 'title', 'name', 'productTitle', 'productName', 'itemName');
        const unitPriceStr = this.getField(r, 'unitPrice', 'price', 'sellingPrice', 'unitCost');
        const unitPrice = unitPriceStr ? this.parseNumericField(unitPriceStr) : 0;
        const moqStr = this.getField(r, 'moq', 'minQty', 'minimumOrderQuantity');
        const moq = moqStr ? Math.round(this.parseNumericField(moqStr)) : 1;
        const inventoryQuantityStr = this.getField(r, 'inventoryQuantity', 'stock', 'qty', 'quantity');
        const inventoryQuantity = inventoryQuantityStr ? Math.round(this.parseNumericField(inventoryQuantityStr)) : 0;
        const description = this.getField(r, 'description');
        const status = (this.getField(r, 'status') || 'PUBLISHED').toUpperCase();
        const vendorName = this.getField(r, 'vendorName');
        const categoryName = this.getField(r, 'category', 'categoryName');
        const tagsStr = this.getField(r, 'tags');
        const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
        const compareAtPriceStr = this.getField(r, 'compareAtPrice');
        const compareAtPrice = compareAtPriceStr ? this.parseNumericField(compareAtPriceStr) || null : null;
        const imagesStr = this.getField(r, 'images', 'imageUrls', 'imageUrl', 'image', 'imageLink', 'imageLinks', 'productImage', 'productImages');
        const imageUrlList = imagesStr ? imagesStr.split(',').map((u: string) => u.trim()).filter(Boolean) : [];

        if (!sku || !title || !unitPrice) {
          const missing = [!sku && 'sku', !title && 'title', !unitPrice && 'unitPrice'].filter(Boolean).join(', ');
          results.errors.push(`Row ${i + 2}: Missing required fields (${missing})`);
          continue;
        }

        const categoryId = categoryName
          ? await this.resolveCategoryIdByName(categoryName, categoryCache, results.categoriesCreated)
          : '';

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
              status: (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED') as ProductStatus,
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
              // Re-hosting locally isn't required for the product to have an image —
              // fall back to the original URL so the product still displays something
              // instead of silently ending up with none, while still surfacing the
              // warning so the download failure isn't hidden.
              localImageUrls.push(url);
              results.imageErrors.push(`Row ${i + 2}: Could not download/re-host image (used original URL instead): ${url}`);
            }
          } else if (url.startsWith('/uploads/')) {
            localImageUrls.push(url);
          }
        }

        // 2) Save locally-uploaded image files matched by SKU (resize to max 1200px, convert to WebP)
        const skuMatchedFiles = imageFiles.filter(
          (f) => imageMapping[f.originalname] === sku,
        );
        for (const f of skuMatchedFiles) {
          const dir = path.join(process.cwd(), 'uploads', 'products');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
          const filePath = path.join(dir, filename);
          try {
            await sharp(f.buffer)
              .resize(1200, null, { withoutEnlargement: true, fit: 'inside' })
              .webp({ quality: 80 })
              .toFile(filePath);
          } catch {
            // Fallback: save original if resize fails
            fs.writeFileSync(filePath, f.buffer);
          }
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
