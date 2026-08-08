import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkOrderStatus } from '@prisma/client';
import { CreateBulkOrderDto } from './dto/create-bulk-order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';

const PRODUCT_SELECT = { id: true, title: true, handle: true, thumbnail: true, sku: true };
const USER_SELECT = { id: true, firstName: true, lastName: true, email: true, companyName: true };

@Injectable()
export class BulkOrdersService {
  private readonly logger = new Logger(BulkOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

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
        status: BulkOrderStatus.PENDING,
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

  async updateStatus(id: string, status: BulkOrderStatus, comment?: string, changedBy?: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!bulkOrder) throw new NotFoundException('Bulk order request not found');

    if (bulkOrder.status !== BulkOrderStatus.PENDING) {
      throw new BadRequestException('This request has already been decided');
    }

    const updated = await this.prisma.bulkOrder.update({
      where: { id },
      data: { status, adminComment: comment ?? null },
      include: {
        user: { select: USER_SELECT },
        product: { select: PRODUCT_SELECT },
      },
    });

    await this.prisma.bulkOrderStatusHistory.create({
      data: { bulkOrderId: id, status, comment: comment ?? null, changedBy: changedBy ?? null },
    });

    await this.notifyDecision(updated);

    return updated;
  }

  private async notifyDecision(bulkOrder: { id: string; userId: string | null; bulkOrderNumber: string; email: string; status: BulkOrderStatus; adminComment: string | null }) {
    if (bulkOrder.userId) {
      try {
        await this.notificationsService.createNotification(
          bulkOrder.userId,
          'SYSTEM',
          `Bulk order request ${bulkOrder.status === BulkOrderStatus.ACCEPTED ? 'accepted' : 'rejected'}`,
          `Your bulk order request #${bulkOrder.bulkOrderNumber} has been ${bulkOrder.status === BulkOrderStatus.ACCEPTED ? 'accepted' : 'rejected'}.${bulkOrder.adminComment ? ` Note: ${bulkOrder.adminComment}` : ''}`,
          { bulkOrderId: bulkOrder.id, status: bulkOrder.status },
        );
      } catch (err) {
        this.logger.error(`Failed to send in-app notification for bulk order ${bulkOrder.id}: ${err.message}`);
      }
    }

    try {
      await this.emailService.sendBulkOrderDecisionEmail(bulkOrder.email, bulkOrder.bulkOrderNumber, bulkOrder.status, bulkOrder.adminComment);
    } catch (err) {
      this.logger.error(`Failed to send decision email for bulk order ${bulkOrder.id}: ${err.message}`);
    }
  }

  async findMineByUser(userId: string) {
    return this.prisma.bulkOrder.findMany({
      where: { userId },
      include: { product: { select: PRODUCT_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(id: string) {
    const bulkOrder = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!bulkOrder) throw new NotFoundException('Bulk order request not found');
    return this.prisma.bulkOrderStatusHistory.findMany({
      where: { bulkOrderId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
