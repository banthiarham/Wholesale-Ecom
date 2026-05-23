import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonalDiscountDto } from './dto/create-seasonal-discount.dto';

@Injectable()
export class SeasonalDiscountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.seasonalDiscount.findMany({
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const discount = await this.prisma.seasonalDiscount.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!discount) throw new NotFoundException('Seasonal discount not found');
    return discount;
  }

  async create(dto: CreateSeasonalDiscountDto) {
    return this.prisma.seasonalDiscount.create({
      data: {
        name: dto.name,
        type: dto.type,
        value: dto.value,
        minQty: dto.minQty ?? 1,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        productId: dto.productId || null,
        categoryId: dto.categoryId || null,
      },
    });
  }

  async update(id: string, dto: Partial<CreateSeasonalDiscountDto>) {
    return this.prisma.seasonalDiscount.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.seasonalDiscount.delete({ where: { id } });
    return { success: true };
  }
}
