import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { PaymentGatewaysService } from '../payment-gateways/payment-gateways.service';
import { PaymentGatewayFactory } from '../payment-gateways/gateways/gateway.factory';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private gatewaysService: PaymentGatewaysService,
    private gatewayFactory: PaymentGatewayFactory,
  ) {}

  async create(orderId: string, provider: string, amount: number) {
    return this.prisma.payment.create({
      data: {
        orderId,
        provider,
        amount,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async verify(orderId: string, providerRef: string, status: PaymentStatus) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    return this.prisma.payment.update({
      where: { orderId },
      data: { providerRef, status },
    });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId }, include: { gateway: true } });
  }

  async findAll(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        gateway: { select: { id: true, provider: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generic payment initiation for any configured gateway.
   */
  async initiatePayment(orderId: string, provider: string, returnUrl?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        items: { include: { product: { select: { title: true } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const gatewayConfig = await this.gatewaysService.getGatewayConfig(provider);
    const gatewayProvider = this.gatewayFactory.getProvider(provider);

    const defaultReturnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/orders/${orderId}`;
    const effectiveReturnUrl = returnUrl || defaultReturnUrl;

    let existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!existingPayment) {
      existingPayment = await this.prisma.payment.create({
        data: {
          orderId,
          provider,
          amount: Number(order.totalAmount),
          status: PaymentStatus.PENDING,
          gatewayId: gatewayConfig.gatewayId !== 'env-fallback' ? gatewayConfig.gatewayId : null,
        },
      });
    }

    const result = await gatewayProvider.initiatePayment({
      orderId: order.id,
      amount: Number(order.totalAmount),
      currency: order.currency || 'INR',
      customerInfo: {
        name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'Customer',
        email: order.user.email || '',
        phone: order.user.phone || '',
      },
      returnUrl: effectiveReturnUrl,
      credentials: gatewayConfig.credentials,
      testMode: gatewayConfig.testMode,
    });

    return {
      ...result,
      gatewayUrl: gatewayConfig.gatewayUrl,
      orderId: order.id,
      provider,
    };
  }

  /**
   * Generic callback handler for any gateway.
   */
  async handleCallback(provider: string, payload: any) {
    const gatewayConfig = await this.gatewaysService.getGatewayConfig(provider);
    const gatewayProvider = this.gatewayFactory.getProvider(provider);

    const result = await gatewayProvider.handleCallback(payload, gatewayConfig.credentials, gatewayConfig.testMode);

    if (result.orderId) {
      await this.prisma.payment.upsert({
        where: { orderId: result.orderId },
        update: {
          status: result.paymentStatus,
          providerRef: result.providerRef,
        },
        create: {
          orderId: result.orderId,
          provider,
          providerRef: result.providerRef,
          amount: 0,
          status: result.paymentStatus,
          gatewayId: gatewayConfig.gatewayId !== 'env-fallback' ? gatewayConfig.gatewayId : null,
        },
      });

      await this.prisma.order.update({
        where: { id: result.orderId },
        data: { status: result.orderStatus },
      });
    }

    return result;
  }

  /**
   * Initiate CCAvenue payment (backward compatible).
   */
  async initiateCcavenue(orderId: string, returnUrl: string) {
    return this.initiatePayment(orderId, 'CCAVENUE', returnUrl);
  }

  /**
   * Handle CCAvenue callback (backward compatible).
   */
  async handleCcavenueCallback(encryptedResponse: string) {
    return this.handleCallback('CCAVENUE', { encResp: encryptedResponse });
  }
}