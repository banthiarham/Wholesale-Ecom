import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentOfferDto } from './dto/create-payment-offer.dto';

@Injectable()
export class PaymentOffersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.paymentOffer.findMany({
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const offer = await this.prisma.paymentOffer.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!offer) throw new NotFoundException('Payment offer not found');
    return offer;
  }

  async create(dto: CreatePaymentOfferDto) {
    return this.prisma.paymentOffer.create({
      data: {
        name: dto.name,
        offerType: dto.offerType,
        type: dto.type,
        value: dto.value,
        maxDiscount: dto.maxDiscount ?? null,
        minOrderValue: dto.minOrderValue ?? null,
        bankName: dto.bankName || null,
        upiApp: dto.upiApp || null,
        cardType: dto.cardType ?? 'BOTH',
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        productId: dto.productId || null,
        categoryId: dto.categoryId || null,
        description: dto.description || null,
      },
    });
  }

  async update(id: string, dto: Partial<CreatePaymentOfferDto>) {
    return this.prisma.paymentOffer.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        maxDiscount: dto.maxDiscount !== undefined ? dto.maxDiscount : undefined,
        minOrderValue: dto.minOrderValue !== undefined ? dto.minOrderValue : undefined,
        bankName: dto.bankName !== undefined ? dto.bankName || null : undefined,
        upiApp: dto.upiApp !== undefined ? dto.upiApp || null : undefined,
        productId: dto.productId !== undefined ? dto.productId || null : undefined,
        categoryId: dto.categoryId !== undefined ? dto.categoryId || null : undefined,
        description: dto.description !== undefined ? dto.description || null : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.paymentOffer.delete({ where: { id } });
    return { success: true };
  }

  async findApplicable(productId?: string, categoryId?: string) {
    const now = new Date();
    return this.prisma.paymentOffer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          { productId: productId || undefined },
          { categoryId: categoryId || undefined },
          { productId: null, categoryId: null },
        ],
      },
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { value: 'desc' },
    });
  }
}