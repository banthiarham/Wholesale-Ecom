import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: any) {
    const where: any = { status: 'PUBLISHED' };

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

    return this.prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, handle: true } },
        tierPrices: { orderBy: { minQty: 'asc' } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, tierPrices: true },
    });
  }

  async remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
