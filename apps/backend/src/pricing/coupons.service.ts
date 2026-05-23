import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findByCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrderValue: dto.minOrderValue || null,
        maxUses: dto.maxUses || null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async update(id: string, dto: Partial<CreateCouponDto>) {
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.code) data.code = dto.code.toUpperCase();
    return this.prisma.coupon.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }
}
