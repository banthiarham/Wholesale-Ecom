import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractPriceDto } from './dto/create-contract-price.dto';

/** "Valid until" is a calendar date: keep the contract usable through the end of that day. */
function endOfDay(value: string): Date {
  const d = new Date(value);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class ContractPricesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string, productId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (productId) where.productId = productId;
    return this.prisma.contractPrice.findMany({
      where,
      include: {
        product: { select: { id: true, title: true, handle: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const contract = await this.prisma.contractPrice.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract price not found');
    return contract;
  }

  async create(dto: CreateContractPriceDto) {
    // One contract per buyer and product: saving again replaces (and re-activates) it instead of failing.
    const data = {
      price: dto.price,
      minQty: dto.minQty ?? 1,
      validUntil: dto.validUntil ? endOfDay(dto.validUntil) : null,
      isActive: true,
    };
    return this.prisma.contractPrice.upsert({
      where: { productId_userId: { productId: dto.productId, userId: dto.userId } },
      create: { productId: dto.productId, userId: dto.userId, ...data },
      update: data,
      include: {
        product: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async update(id: string, dto: Partial<CreateContractPriceDto>) {
    const data: any = { ...dto };
    // undefined = leave as is, null/'' = no expiry, date = valid through the end of that day
    if (dto.validUntil === null || dto.validUntil === '') data.validUntil = null;
    else if (dto.validUntil) data.validUntil = endOfDay(dto.validUntil);
    return this.prisma.contractPrice.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async remove(id: string) {
    await this.prisma.contractPrice.delete({ where: { id } });
    return { success: true };
  }
}
