import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnStatus, ReturnType, OrderStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
};

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, data: { orderId: string; reason: string; notes?: string; type?: ReturnType; items: { orderItemId: string; quantity: number; reason?: string }[] }) {
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
        type: data.type || ReturnType.RETURN,
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

  async updateStatus(id: string, status: ReturnStatus, refundAmount?: number, remarks?: string, changedBy?: string) {
    const data: any = { status };
    if (refundAmount !== undefined) data.refundAmount = refundAmount;
    if (remarks !== undefined) data.adminRemarks = remarks ?? null;

    const ret = await this.prisma.returnRequest.update({
      where: { id },
      data,
      include: {
        items: true,
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
      },
    });

    await this.prisma.returnStatusHistory.create({
      data: { returnRequestId: id, status, remarks: remarks ?? null, changedBy: changedBy ?? null },
    });

    try {
      const typeLabel = ret.type === ReturnType.REPLACEMENT ? 'Replacement' : 'Return';
      await this.notificationsService.createNotification(
        ret.userId,
        'RETURN',
        `${typeLabel} request ${RETURN_STATUS_LABELS[status]}`,
        `Your ${typeLabel.toLowerCase()} request for order #${ret.order.orderNumber.slice(0, 8)} is now ${RETURN_STATUS_LABELS[status]}.${ret.adminRemarks ? ` Note: ${ret.adminRemarks}` : ''}`,
        { returnId: ret.id, orderId: ret.orderId, status },
      );
    } catch (err) {
      this.logger.error(`Failed to send notification for return ${id}: ${err.message}`);
    }

    const enrichedItems = ret.items.map((ri) => {
      const oi = ret.order.items?.find((o: any) => o.id === ri.orderItemId);
      return { ...ri, orderItem: oi ? { product: oi.product } : null };
    });

    return { ...ret, items: enrichedItems };
  }

  async getHistory(id: string, userId?: string, role?: string) {
    const ret = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return request not found');
    if (role !== UserRole.ADMIN && role !== UserRole.VENDOR && ret.userId !== userId) {
      throw new NotFoundException('Return request not found');
    }
    return this.prisma.returnStatusHistory.findMany({
      where: { returnRequestId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}