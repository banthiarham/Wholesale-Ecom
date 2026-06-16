import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkOrderStatus } from '@prisma/client';

@Injectable()
export class BulkOrdersService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.bulkOrder.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true, thumbnail: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: BulkOrderStatus) {
    const where = status ? { status } : {};
    return this.prisma.bulkOrder.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true, thumbnail: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true, thumbnail: true, sku: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        order: true,
      },
    });
    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    return bulkOrder;
  }

  async updateStatus(id: string, status: BulkOrderStatus) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!bulkOrder) throw new NotFoundException('Bulk order not found');

    const current = bulkOrder.status;
    if (current === BulkOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change status of a cancelled bulk order');
    }
    if (current === BulkOrderStatus.PLACED && status === BulkOrderStatus.DRAFT) {
      throw new BadRequestException('Cannot revert a placed bulk order to draft');
    }
    if (current === status) {
      throw new BadRequestException(`Bulk order is already ${status}`);
    }

    return this.prisma.bulkOrder.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { id: true, title: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async convertToOrder(id: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({
      where: { id },
      include: { items: true, user: true },
    });
    if (!bulkOrder) throw new NotFoundException('Bulk order not found');
    if (bulkOrder.status !== BulkOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft bulk orders can be converted to orders');
    }
    if (bulkOrder.orderId) {
      throw new BadRequestException('Bulk order already has an associated order');
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: bulkOrder.userId,
          shippingAddress: bulkOrder.shippingAddress,
          totalAmount: bulkOrder.totalAmount,
          status: 'PENDING',
          notes: bulkOrder.notes
            ? `Converted from bulk order ${bulkOrder.bulkOrderNumber}. ${bulkOrder.notes}`
            : `Converted from bulk order ${bulkOrder.bulkOrderNumber}`,
          items: {
            create: bulkOrder.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      });

      await tx.bulkOrder.update({
        where: { id },
        data: {
          orderId: newOrder.id,
          status: BulkOrderStatus.PLACED,
        },
      });

      return newOrder;
    });

    return { order, bulkOrderId: id };
  }
}