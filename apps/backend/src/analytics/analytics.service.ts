import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSalesOverview(startDate?: string, endDate?: string) {
    const where = this.buildDateFilter(startDate, endDate);
    const [totalOrders, totalRevenue, totalProductsSold, avgOrderValue] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.orderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
      this.prisma.order.aggregate({ where, _avg: { totalAmount: true } }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalProductsSold: totalProductsSold._sum.quantity || 0,
      avgOrderValue: avgOrderValue._avg.totalAmount || 0,
    };
  }

  async getOrdersByStatus(startDate?: string, endDate?: string) {
    const where = this.buildDateFilter(startDate, endDate);
    const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
    const result: Record<string, number> = {};
    for (const status of statuses) {
      result[status] = await this.prisma.order.count({ where: { ...where, status } });
    }
    return result;
  }

  async getTopProducts(limit = 10) {
    return this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
  }

  async getVendorAnalytics(vendorId: string) {
    const [productsCount, ordersCount, totalSales] = await Promise.all([
      this.prisma.product.count({ where: { vendorId } }),
      this.prisma.orderItem.count({ where: { product: { vendorId } } }),
      this.prisma.orderItem.aggregate({ where: { product: { vendorId } }, _sum: { totalPrice: true } }),
    ]);
    return { vendorId, productsCount, ordersCount, totalSales: totalSales._sum.totalPrice || 0 };
  }

  async getBuyerAnalytics(userId: string) {
    const [ordersCount, totalSpent, favoriteCategory] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.aggregate({ where: { userId }, _sum: { totalAmount: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { userId } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 1,
      }),
    ]);
    return { userId, ordersCount, totalSpent: totalSpent._sum.totalAmount || 0, topProductId: favoriteCategory[0]?.productId || null };
  }

  async getRecentActivity(limit = 20) {
    const [recentOrders, recentReviews, recentRfqs] = await Promise.all([
      this.prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { firstName: true, lastName: true } } } }),
      this.prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { firstName: true, lastName: true } }, product: { select: { title: true } } } }),
      this.prisma.rfq.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { buyer: { select: { firstName: true, lastName: true } } } }),
    ]);
    return { recentOrders, recentReviews, recentRfqs };
  }

  private buildDateFilter(startDate?: string, endDate?: string) {
    const filter: any = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = new Date(startDate);
      if (endDate) filter.createdAt.lte = new Date(endDate);
    }
    return filter;
  }
}
