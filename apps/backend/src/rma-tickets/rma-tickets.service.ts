import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnStatus, RmaTicketPriority, RmaTicketStatus } from '@prisma/client';

@Injectable()
export class RmaTicketsService {
  constructor(private prisma: PrismaService) {}

  async findByReturnRequest(returnRequestId: string) {
    return this.prisma.rmaTicket.findUnique({
      where: { returnRequestId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        activities: {
          include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(
    id: string,
    data: { status?: RmaTicketStatus; priority?: RmaTicketPriority; assignedToId?: string | null; note?: string },
    changedById: string,
  ) {
    const ticket = await this.prisma.rmaTicket.findUnique({
      where: { id },
      include: { returnRequest: { select: { status: true } } },
    });
    if (!ticket) throw new NotFoundException('RMA ticket not found');

    if (data.status === RmaTicketStatus.CLOSED && ticket.returnRequest.status !== ReturnStatus.COMPLETED) {
      throw new BadRequestException('Ticket can only be closed when the related return/replacement is completed');
    }
    if (ticket.returnRequest.status === ReturnStatus.COMPLETED && data.status && data.status !== RmaTicketStatus.CLOSED) {
      throw new BadRequestException('A ticket linked to a completed return/replacement must remain closed');
    }
    if (data.assignedToId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: data.assignedToId }, select: { id: true } });
      if (!assignee) throw new BadRequestException('Assigned user not found');
    }

    const statusChanged = data.status && data.status !== ticket.status;
    const closedAt = data.status === RmaTicketStatus.CLOSED ? new Date() : data.status ? null : ticket.closedAt;
    const resolutionTimeMinutes = closedAt
      ? Math.max(0, Math.floor((closedAt.getTime() - ticket.openedAt.getTime()) / 60000))
      : data.status ? null : ticket.resolutionTimeMinutes;

    await this.prisma.$transaction(async (tx) => {
      await tx.rmaTicket.update({
        where: { id },
        data: {
          ...(data.status ? { status: data.status, closedAt, resolutionTimeMinutes } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
        },
      });
      if (statusChanged) {
        await tx.rmaTicketActivity.create({
          data: { ticketId: id, fromStatus: ticket.status, toStatus: data.status!, note: data.note || null, changedById },
        });
      }
    });

    return this.prisma.rmaTicket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        activities: { include: { changedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getKpis() {
    const [totalTickets, openTickets, closedTickets, resolution] = await Promise.all([
      this.prisma.rmaTicket.count(),
      this.prisma.rmaTicket.count({ where: { status: { in: [RmaTicketStatus.OPEN, RmaTicketStatus.PENDING, RmaTicketStatus.IN_PROGRESS] } } }),
      this.prisma.rmaTicket.count({ where: { status: RmaTicketStatus.CLOSED } }),
      this.prisma.rmaTicket.aggregate({ where: { status: RmaTicketStatus.CLOSED }, _avg: { resolutionTimeMinutes: true } }),
    ]);
    return {
      totalTickets,
      openTickets,
      closedTickets,
      resolutionRate: totalTickets ? Number(((closedTickets / totalTickets) * 100).toFixed(1)) : 0,
      averageResolutionTimeMinutes: Math.round(resolution._avg.resolutionTimeMinutes || 0),
    };
  }
}
