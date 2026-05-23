import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  async getRecommendationsForUser(userId: string, limit = 10) {
    const userOrders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: { select: { productId: true } } },
    });

    const purchasedProductIds = new Set<string>();
    userOrders.forEach((o) => o.items.forEach((i) => purchasedProductIds.add(i.productId)));

    if (purchasedProductIds.size === 0) {
      return this.getPopularProducts(limit);
    }

    const similarBuyers = await this.prisma.orderItem.findMany({
      where: { productId: { in: Array.from(purchasedProductIds) }, NOT: { order: { userId } } },
      select: { order: { select: { userId: true } }, productId: true },
      distinct: ['orderId'],
    });

    const candidateProductIds = new Map<string, number>();
    for (const item of similarBuyers) {
      if (!purchasedProductIds.has(item.productId)) {
        candidateProductIds.set(item.productId, (candidateProductIds.get(item.productId) || 0) + 1);
      }
    }

    const sorted = Array.from(candidateProductIds.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (sorted.length === 0) {
      return this.getPopularProducts(limit);
    }

    return this.prisma.product.findMany({
      where: { id: { in: sorted }, status: 'PUBLISHED' },
      include: { category: true, tierPrices: true },
    });
  }

  async getPopularProducts(limit = 10) {
    const top = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = top.map((t) => t.productId);
    return this.prisma.product.findMany({
      where: { id: { in: productIds }, status: 'PUBLISHED' },
      include: { category: true, tierPrices: true },
    });
  }

  async getSimilarProducts(productId: string, limit = 6) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return [];

    return this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: productId },
        status: 'PUBLISHED',
      },
      include: { category: true, tierPrices: true },
      take: limit,
    });
  }
}
