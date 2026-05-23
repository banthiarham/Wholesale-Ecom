import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuoteStatus, RfqStatus, UserRole } from '@prisma/client';

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  async createQuote(rfqId: string, vendorId: string, dto: any) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { items: true },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    const openStatuses: RfqStatus[] = [RfqStatus.SUBMITTED, RfqStatus.UNDER_REVIEW, RfqStatus.QUOTED]
    if (!openStatuses.includes(rfq.status)) {
      throw new BadRequestException('RFQ is not open for quotes');
    }

    const totalAmount = dto.totalAmount || dto.items.reduce((sum: number, item: any) => {
      return sum + (item.totalPrice || item.unitPrice * item.quantity);
    }, 0);

    const quote = await this.prisma.quote.create({
      data: {
        rfqId,
        vendorId,
        totalAmount,
        notes: dto.notes,
        terms: dto.terms,
        items: {
          create: dto.items.map((item: any) => ({
            rfqItemId: item.rfqItemId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice || item.unitPrice * item.quantity,
            leadTimeDays: item.leadTimeDays || null,
            notes: item.notes,
          })),
        },
      },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        items: true,
      },
    });

    // Update RFQ status to UNDER_REVIEW if it's the first quote, or keep QUOTED
    if (rfq.status === RfqStatus.SUBMITTED) {
      await this.prisma.rfq.update({ where: { id: rfqId }, data: { status: RfqStatus.UNDER_REVIEW } });
    }

    return quote;
  }

  async findByRfq(rfqId: string, userId?: string, role?: UserRole) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (role === UserRole.BUYER && rfq.buyerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.quote.findMany({
      where: { rfqId },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        items: { include: { rfqItem: { include: { product: { select: { id: true, title: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVendorQuotes(vendorId: string) {
    return this.prisma.quote.findMany({
      where: { vendorId },
      include: {
        rfq: { select: { id: true, title: true, status: true, buyerId: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateQuote(id: string, dto: any, vendorId: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.vendorId !== vendorId) throw new ForbiddenException('Access denied');
    if (quote.status !== QuoteStatus.PENDING) throw new BadRequestException('Only pending quotes can be updated');

    return this.prisma.quote.update({
      where: { id },
      data: {
        totalAmount: dto.totalAmount,
        notes: dto.notes,
        terms: dto.terms,
      },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        items: true,
      },
    });
  }

  async acceptQuote(id: string, userId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { rfq: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.rfq.buyerId !== userId) throw new ForbiddenException('Access denied');
    if (quote.status !== QuoteStatus.PENDING) throw new BadRequestException('Quote is not pending');

    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.ACCEPTED },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        items: true,
      },
    });

    // Reject all other quotes for this RFQ
    await this.prisma.quote.updateMany({
      where: { rfqId: quote.rfqId, id: { not: id } },
      data: { status: QuoteStatus.REJECTED },
    });

    // Update RFQ status
    await this.prisma.rfq.update({
      where: { id: quote.rfqId },
      data: { status: RfqStatus.ACCEPTED },
    });

    return updated;
  }

  async rejectQuote(id: string, userId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { rfq: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.rfq.buyerId !== userId) throw new ForbiddenException('Access denied');
    if (quote.status !== QuoteStatus.PENDING) throw new BadRequestException('Quote is not pending');

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.REJECTED },
      include: {
        vendor: { select: { id: true, firstName: true, lastName: true, email: true, companyName: true } },
        items: true,
      },
    });
  }
}
