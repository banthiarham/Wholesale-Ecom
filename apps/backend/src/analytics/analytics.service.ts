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

  async getDeliveryStats() {
    const [totalShipments, trackingRecords, recentEvents] = await Promise.all([
      this.prisma.order.count({ where: { deliveryPartnerId: { not: null } } }),
      this.prisma.deliveryTracking.findMany({
        include: { _count: { select: { events: true } } },
      }),
      this.prisma.deliveryTrackingEvent.findMany({
        take: 10,
        orderBy: { occurredAt: 'desc' },
        include: { tracking: { include: { order: { select: { orderNumber: true } } } } },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const t of trackingRecords) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    }

    const byPartner = await this.prisma.order.groupBy({
      by: ['deliveryPartnerId'],
      where: { deliveryPartnerId: { not: null } },
      _count: { id: true },
    });

    const partnerIds = byPartner.map((b) => b.deliveryPartnerId!).filter(Boolean);
    const partners = await this.prisma.deliveryPartner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true },
    });
    const partnerMap = Object.fromEntries(partners.map((p) => [p.id, p.name]));

    return {
      totalShipments,
      byStatus,
      byPartner: byPartner.map((b) => ({
        partnerId: b.deliveryPartnerId,
        partnerName: partnerMap[b.deliveryPartnerId!] || 'Unknown',
        count: b._count.id,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        status: e.status,
        location: e.location,
        notes: e.notes,
        occurredAt: e.occurredAt,
        orderNumber: e.tracking?.order?.orderNumber,
      })),
    };
  }
}
