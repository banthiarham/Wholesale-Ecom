import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnStatus, ReturnType, OrderStatus, UserRole, RmaTicketStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { randomUUID } from 'crypto';

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
};

const RMA_STATUS_FROM_RETURN: Record<ReturnStatus, RmaTicketStatus> = {
  REQUESTED: RmaTicketStatus.OPEN,
  APPROVED: RmaTicketStatus.IN_PROGRESS,
  REJECTED: RmaTicketStatus.CANCELLED,
  PROCESSING: RmaTicketStatus.IN_PROGRESS,
  COMPLETED: RmaTicketStatus.CLOSED,
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

    const returnRequestId = randomUUID();
    const ticketNumber = `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${returnRequestId.slice(0, 8).toUpperCase()}`;
    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        id: returnRequestId,
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
        rmaTicket: {
          create: {
            ticketNumber,
            customerId: userId,
            orderId: data.orderId,
            activities: {
              create: { toStatus: RmaTicketStatus.OPEN, note: 'Ticket opened automatically with return/replacement request', changedById: userId },
            },
          },
        },
      },
      include: {
        items: true,
        order: { select: { orderNumber: true } },
        rmaTicket: { include: { assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }, activities: { orderBy: { createdAt: 'desc' } } } },
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
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
        rmaTicket: { include: { assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }, activities: { orderBy: { createdAt: 'desc' } } } },
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
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
        rmaTicket: {
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
            activities: { include: { changedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
          },
        },
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

    const existing = await this.prisma.returnRequest.findUnique({ where: { id }, include: { rmaTicket: true } });
    if (!existing) throw new NotFoundException('Return request not found');
    if (existing.status === ReturnStatus.COMPLETED && status !== ReturnStatus.COMPLETED) {
      throw new BadRequestException('A completed return/replacement cannot be reopened');
    }
    const targetTicketStatus = RMA_STATUS_FROM_RETURN[status];
    const now = new Date();

    const ret = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id },
        data,
        include: {
          items: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          order: { select: { orderNumber: true, items: { include: { product: { select: { id: true, title: true, thumbnail: true } } } } } },
          rmaTicket: { include: { assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }, activities: { include: { changedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } } } },
        },
      });
      await tx.returnStatusHistory.create({
        data: { returnRequestId: id, status, remarks: remarks ?? null, changedBy: changedBy ?? null },
      });
      if (existing.rmaTicket && existing.rmaTicket.status !== targetTicketStatus) {
        const closedAt = targetTicketStatus === RmaTicketStatus.CLOSED ? now : null;
        await tx.rmaTicket.update({
          where: { id: existing.rmaTicket.id },
          data: {
            status: targetTicketStatus,
            closedAt,
            resolutionTimeMinutes: closedAt ? Math.max(0, Math.floor((closedAt.getTime() - existing.rmaTicket.openedAt.getTime()) / 60000)) : null,
          },
        });
        await tx.rmaTicketActivity.create({
          data: {
            ticketId: existing.rmaTicket.id,
            fromStatus: existing.rmaTicket.status,
            toStatus: targetTicketStatus,
            note: remarks || `Return/replacement moved to ${status}`,
            changedById: changedBy || null,
          },
        });
      }
      return updated;
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
