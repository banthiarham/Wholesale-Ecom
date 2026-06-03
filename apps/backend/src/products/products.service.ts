import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      await tx.catalogItem.deleteMany({ where: { productId: id } });
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

  async bulkUploadFromExcel(buffer: Buffer) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty or has no data rows');
    }

    const results = { created: 0, updated: 0, errors: [] as string[] };

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

        if (!sku || !title || !unitPrice) {
          results.errors.push(`Row ${i + 2}: Missing required fields (sku, title, unitPrice)`);
          continue;
        }

        // Check if product with this SKU already exists
        const existing = await this.prisma.product.findUnique({ where: { sku } });

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
          results.updated++;
        } else {
          // Create new product — generate handle from title
          const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

          await this.prisma.product.create({
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
          results.created++;
        }
      } catch (err) {
        results.errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    return results;
  }
}
