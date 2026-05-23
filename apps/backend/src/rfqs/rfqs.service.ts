import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RfqStatus, UserRole } from '@prisma/client';

@Injectable()
export class RfqsService {
  constructor(private prisma: PrismaService) {}

  async createRfq(buyerId: string, dto: any) {
    const rfq = await this.prisma.rfq.create({
      data: {
        buyerId,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        items: {
          create: dto.items.map((item: any) => ({
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'units',
            targetPrice: item.targetPrice || null,
            notes: item.notes,
          })),
        },
      },
      include: { items: { include: { product: { select: { id: true, title: true, sku: true } } } } },
    });
    return rfq;
  }

  async findAll(userId: string, role: UserRole) {
    const where: any = {};
    if (role === UserRole.BUYER) {
      where.buyerId = userId;
    } else if (role === UserRole.VENDOR) {
      where.status = { in: [RfqStatus.SUBMITTED, RfqStatus.UNDER_REVIEW, RfqStatus.QUOTED] };
    }
    // ADMIN sees all

    return this.prisma.rfq.findMany({
      where,
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { product: { select: { id: true, title: true, sku: true } } } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId?: string, role?: UserRole) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { product: { select: { id: true, title: true, sku: true } } } },
        quotes: {
          include: {
            vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
            items: true,
          },
        },
      },
    });

    if (!rfq) throw new NotFoundException('RFQ not found');

    if (role === UserRole.BUYER && rfq.buyerId !== userId) {
      throw new ForbiddenException('You do not have access to this RFQ');
    }

    return rfq;
  }

  async updateRfq(id: string, dto: any, userId: string, role: UserRole) {
    const rfq = await this.findById(id, userId, role);
    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be edited');
    }

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    if (dto.items && dto.items.length > 0) {
      await this.prisma.rfqItem.deleteMany({ where: { rfqId: id } });
      updateData.items = {
        create: dto.items.map((item: any) => ({
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'units',
          targetPrice: item.targetPrice || null,
          notes: item.notes,
        })),
      };
    }

    return this.prisma.rfq.update({
      where: { id },
      data: updateData,
      include: { items: { include: { product: { select: { id: true, title: true, sku: true } } } } },
    });
  }

  async submitRfq(id: string, userId: string, role: UserRole) {
    const rfq = await this.findById(id, userId, role);
    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be submitted');
    }

    return this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.SUBMITTED },
      include: { items: { include: { product: { select: { id: true, title: true, sku: true } } } } },
    });
  }

  async cancelRfq(id: string, userId: string, role: UserRole) {
    const rfq = await this.findById(id, userId, role);
    if (rfq.status === RfqStatus.ACCEPTED || rfq.status === RfqStatus.REJECTED || rfq.status === RfqStatus.EXPIRED) {
      throw new BadRequestException('Cannot cancel a finalized RFQ');
    }

    return this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.REJECTED },
      include: { items: { include: { product: { select: { id: true, title: true, sku: true } } } } },
    });
  }
}
