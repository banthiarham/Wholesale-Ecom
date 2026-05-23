import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, RfqStatus, UserRole } from '@prisma/client';

@Injectable()
export class VendorService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(vendorId: string) {
    const productCount = await this.prisma.product.count({ where: { vendorId } });
    const lowStockCount = await this.prisma.product.count({
      where: { vendorId, inventoryQuantity: { lte: 10 } },
    });

    const orders = await this.prisma.orderItem.findMany({
      where: { product: { vendorId } },
      include: { order: { select: { id: true, status: true, totalAmount: true } } },
    });

    const orderCount = orders.length;
    const revenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const pendingRfqCount = await this.prisma.rfq.count({
      where: { status: { in: [RfqStatus.SUBMITTED, RfqStatus.UNDER_REVIEW] } },
    });

    return {
      productCount,
      lowStockCount,
      orderCount,
      revenue,
      pendingRfqCount,
    };
  }

  async getProducts(vendorId: string) {
    return this.prisma.product.findMany({
      where: { vendorId },
      include: {
        category: { select: { id: true, name: true, handle: true } },
        tierPrices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrders(vendorId: string) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { product: { vendorId } },
      include: {
        order: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            payment: true,
          },
        },
        product: { select: { id: true, title: true, sku: true } },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    // Group by order
    const orderMap = new Map();
    for (const item of orderItems) {
      if (!orderMap.has(item.orderId)) {
        orderMap.set(item.orderId, { ...item.order, items: [] });
      }
      orderMap.get(item.orderId).items.push({
        id: item.id,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });
    }

    return Array.from(orderMap.values());
  }

  async getRfqs() {
    return this.prisma.rfq.findMany({
      where: { status: { in: [RfqStatus.SUBMITTED, RfqStatus.UNDER_REVIEW] } },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { product: { select: { id: true, title: true, sku: true } } } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSales(vendorId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const items = await this.prisma.orderItem.findMany({
      where: {
        product: { vendorId },
        order: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] } },
      },
      include: { product: { select: { id: true, title: true } }, order: { select: { createdAt: true } } },
    });

    const revenueByDay = new Map();
    const productSales = new Map();

    for (const item of items) {
      if (item.order.createdAt < since) continue;
      const day = item.order.createdAt.toISOString().split('T')[0];
      revenueByDay.set(day, (revenueByDay.get(day) || 0) + Number(item.totalPrice));

      const pid = item.productId;
      if (!productSales.has(pid)) {
        productSales.set(pid, { product: item.product, quantity: 0, revenue: 0 });
      }
      const p = productSales.get(pid);
      p.quantity += item.quantity;
      p.revenue += Number(item.totalPrice);
    }

    return {
      totalRevenue: items.reduce((s, i) => s + Number(i.totalPrice), 0),
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      revenueByDay: Array.from(revenueByDay.entries()).map(([date, revenue]) => ({ date, revenue })),
      topProducts: Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }
}
