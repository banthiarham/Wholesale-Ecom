import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            handle: true,
            thumbnail: true,
            unitPrice: true,
            compareAtPrice: true,
            moq: true,
            inventoryQuantity: true,
            tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            handle: true,
            thumbnail: true,
            unitPrice: true,
            compareAtPrice: true,
            moq: true,
            inventoryQuantity: true,
            tierPrices: { select: { minQty: true, maxQty: true, price: true }, orderBy: { minQty: 'asc' } },
          },
        },
      },
    });
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) throw new NotFoundException('Item not in wishlist');

    return this.prisma.wishlistItem.delete({
      where: { id: item.id },
    });
  }
}