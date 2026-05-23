import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractPriceDto } from './dto/create-contract-price.dto';

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
    return this.prisma.contractPrice.create({
      data: {
        productId: dto.productId,
        userId: dto.userId,
        price: dto.price,
        minQty: dto.minQty ?? 1,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
      include: {
        product: { select: { id: true, title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async update(id: string, dto: Partial<CreateContractPriceDto>) {
    const data: any = { ...dto };
    if (dto.validUntil) data.validUntil = new Date(dto.validUntil);
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
