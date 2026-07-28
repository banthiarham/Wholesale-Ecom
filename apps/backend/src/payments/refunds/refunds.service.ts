import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus, OrderStatus, RefundStatus } from '@prisma/client';
import { PaymentGatewaysService } from '../../payment-gateways/payment-gateways.service';
import { PaymentGatewayFactory } from '../../payment-gateways/gateways/gateway.factory';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundsService {
  constructor(
    private prisma: PrismaService,
    private gatewaysService: PaymentGatewaysService,
    private gatewayFactory: PaymentGatewayFactory,
    private notificationsService: NotificationsService,
  ) {}

  async createRefund(orderId: string, dto: CreateRefundDto, adminUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: true, refunds: true },
    });

    if (!payment) throw new NotFoundException('Payment not found for this order');
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured payments can be refunded');
    }
    if (!payment.providerRef) {
      throw new BadRequestException('Payment has no provider reference to refund against');
    }

    const gatewayProvider = this.gatewayFactory.getProvider(payment.provider);
    if (!gatewayProvider.refundPayment) {
      throw new BadRequestException(`${payment.provider} does not support automated refunds`);
    }

    // Duplicate-refund prevention: don't allow a second refund while one is already in flight.
    if (payment.refunds.some((r) => r.status === RefundStatus.PENDING)) {
      throw new BadRequestException('A refund is already in progress for this payment');
    }

    const alreadyRefunded = payment.refunds
      .filter((r) => r.status === RefundStatus.PROCESSED)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const remaining = Number(payment.amount) - alreadyRefunded;

    const amount = dto.amount ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException(`Refund amount must be between 0 and ${remaining.toFixed(2)}`);
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount,
        isPartial: alreadyRefunded + amount < Number(payment.amount),
        reason: dto.reason,
        status: RefundStatus.PENDING,
        initiatedBy: adminUserId,
      },
    });

    const gatewayConfig = await this.gatewaysService.getGatewayConfig(payment.provider);

    let result;
    try {
      result = await gatewayProvider.refundPayment({
        providerPaymentId: payment.providerRef,
        amount,
        credentials: gatewayConfig.credentials,
        notes: { internalRefundId: refund.id, reason: dto.reason || '' },
      });
    } catch (err) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.FAILED, rawResponse: { error: err.message } },
      });
      throw err;
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        razorpayRefundId: result.refundId,
        status: result.status as RefundStatus,
        rawResponse: result.rawResponse,
      },
    });

    if (result.status === 'PROCESSED') {
      const totalRefunded = alreadyRefunded + amount;
      if (totalRefunded >= Number(payment.amount)) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });
        await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
      }

      await this.notificationsService.createNotification(
        payment.order.userId,
        'PAYMENT',
        updatedRefund.isPartial ? 'Partial Refund Processed' : 'Refund Processed',
        `A refund of ${amount.toFixed(2)} ${payment.currency} for order #${payment.order.orderNumber} has been processed.`,
      );
    }

    return updatedRefund;
  }

  async listRefunds(orderId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) throw new NotFoundException('Payment not found for this order');

    return this.prisma.refund.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
