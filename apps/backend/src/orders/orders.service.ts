import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createFromCart(userId: string, cartId: string, data: { shippingAddress: any; billingAddress?: any; notes?: string }) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    let totalAmount = 0;
    const orderItemsData = cart.items.map((item) => {
      const totalPrice = Number(item.unitPrice) * item.quantity;
      totalAmount += totalPrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: totalPrice,
      };
    });

    const order = await this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'INR',
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress || data.shippingAddress,
        notes: data.notes,
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.prisma.cartItem.deleteMany({ where: { cartId } });

    return order;
  }

  async findAll(userId?: string, status?: OrderStatus) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, title: true, thumbnail: true, sku: true } } } },
        payment: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (userId && order.userId !== userId) throw new NotFoundException('Order not found');

    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { id: true, title: true } } } },
        payment: true,
      },
    });
  }

  async cancelOrder(id: string, userId?: string) {
    const order = await this.findById(id, userId);
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot cancel this order');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: {
        items: { include: { product: { select: { id: true, title: true } } } },
        payment: true,
      },
    });
  }
}
