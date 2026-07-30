import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkOrderStatus } from '@prisma/client';
import { CreateBulkOrderDto } from './dto/create-bulk-order.dto';

const PRODUCT_SELECT = { id: true, title: true, handle: true, thumbnail: true, sku: true };
const USER_SELECT = { id: true, firstName: true, lastName: true, email: true, companyName: true };

@Injectable()
export class BulkOrdersService {
  constructor(private prisma: PrismaService) {}

  private generateBulkOrderNumber(): string {
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `BULK-${Date.now()}-${rand}`;
  }

  async create(dto: CreateBulkOrderDto, userId: string | null, attachmentUrl?: string) {
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new BadRequestException('Selected product was not found');
    }

    return this.prisma.bulkOrder.create({
      data: {
        bulkOrderNumber: this.generateBulkOrderNumber(),
        userId: userId || undefined,
        companyName: dto.companyName,
        contactPerson: dto.contactPerson,
        mobileNumber: dto.mobileNumber,
        email: dto.email,
        gstNumber: dto.gstNumber || null,
        businessAddress: dto.businessAddress,
        productId: dto.productId || null,
        products: dto.products,
        quantity: dto.quantity,
        budget: dto.budget,
        expectedDeliveryDate: new Date(dto.expectedDeliveryDate),
        message: dto.message,
        attachmentUrl: attachmentUrl || null,
        status: BulkOrderStatus.NEW,
      },
      include: { product: { select: PRODUCT_SELECT } },
    });
  }

  async findAll(status?: BulkOrderStatus, search?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { bulkOrderNumber: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.bulkOrder.findMany({
      where,
      include: {
        user: { select: USER_SELECT },
        product: { select: PRODUCT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({
      where: { id },
      include: {
        user: { select: USER_SELECT },
        product: { select: PRODUCT_SELECT },
      },
    });
    if (!bulkOrder) throw new NotFoundException('Bulk order request not found');
    return bulkOrder;
  }

  async updateStatus(id: string, status: BulkOrderStatus) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!bulkOrder) throw new NotFoundException('Bulk order request not found');

    if (bulkOrder.status === BulkOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change status of a cancelled request');
    }
    if (bulkOrder.status === BulkOrderStatus.CONFIRMED && status !== BulkOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change status of a confirmed request');
    }

    return this.prisma.bulkOrder.update({
      where: { id },
      data: { status },
      include: {
        user: { select: USER_SELECT },
        product: { select: PRODUCT_SELECT },
      },
    });
  }
}
