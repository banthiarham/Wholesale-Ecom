import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnStatus, OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { orderId: string; reason: string; notes?: string; items: { orderItemId: string; quantity: number; reason?: string }[] }) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('Can only request returns for delivered orders');

    for (const item of data.items) {
      const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) throw new BadRequestException(`Order item ${item.orderItemId} not found in this order`);
      if (item.quantity > orderItem.quantity) throw new BadRequestException(`Return quantity exceeds order quantity for item ${item.orderItemId}`);
    }

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderId: data.orderId,
        userId,
        reason: data.reason,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            reason: item.reason,
          })),
        },
      },
      include: {
        items: true,
        order: { select: { orderNumber: true } },
      },
    });

    // Enrich items with product info from the order
    const enrichedItems = returnRequest.items.map((ri) => {
      const oi = order.items.find((o) => o.id === ri.orderItemId);
      return { ...ri, orderItem: oi ? { product: oi.product } : null };
    });

    return { ...returnRequest, items: enrichedItems };
  }

  async findAll(userId?: string, role?: string) {
    const where: any = {};
    if (role !== UserRole.ADMIN && role !== UserRole.VENDOR && userId) {
      where.userId = userId;
    }

    const returns = await this.prisma.returnRequest.findMany({
      where,
      include: {
        items: true,
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return returns.map((ret) => ({
      ...ret,
      items: ret.items.map((ri) => {
        const oi = ret.order.items?.find((o: any) => o.id === ri.orderItemId);
        return { ...ri, orderItem: oi ? { product: oi.product } : null };
      }),
    }));
  }

  async findById(id: string, userId?: string, role?: string) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        items: true,
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
      },
    });

    if (!ret) throw new NotFoundException('Return request not found');
    if (role !== UserRole.ADMIN && role !== UserRole.VENDOR && ret.userId !== userId) {
      throw new NotFoundException('Return request not found');
    }

    const enrichedItems = ret.items.map((ri) => {
      const oi = ret.order.items?.find((o: any) => o.id === ri.orderItemId);
      return { ...ri, orderItem: oi ? { product: oi.product } : null };
    });

    return { ...ret, items: enrichedItems };
  }

  async updateStatus(id: string, status: ReturnStatus, refundAmount?: number) {
    const data: any = { status };
    if (refundAmount !== undefined) data.refundAmount = refundAmount;

    const ret = await this.prisma.returnRequest.update({
      where: { id },
      data,
      include: {
        items: true,
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
      },
    });

    const enrichedItems = ret.items.map((ri) => {
      const oi = ret.order.items?.find((o: any) => o.id === ri.orderItemId);
      return { ...ri, orderItem: oi ? { product: oi.product } : null };
    });

    return { ...ret, items: enrichedItems };
  }
}