import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, UserRole, RefundStatus } from '@prisma/client';
import { PaymentGatewaysService } from '../payment-gateways/payment-gateways.service';
import { PaymentGatewayFactory } from '../payment-gateways/gateways/gateway.factory';
import { NotificationsService } from '../notifications/notifications.service';
import { RazorpayVerifyDto } from './dto/razorpay-verify.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private gatewaysService: PaymentGatewaysService,
    private gatewayFactory: PaymentGatewayFactory,
    private notificationsService: NotificationsService,
  ) {}

  private assertOwnerOrAdmin(currentUser: any, orderUserId: string) {
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    if (!isAdmin && currentUser?.id !== orderUserId) {
      throw new ForbiddenException('You do not have access to this order\'s payment');
    }
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a || '');
    const bufB = Buffer.from(b || '');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

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

  async findByOrderId(orderId: string, currentUser?: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { gateway: true, order: { select: { userId: true } } },
    });
    if (payment && currentUser) {
      this.assertOwnerOrAdmin(currentUser, payment.order.userId);
    }
    return payment;
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
  async initiatePayment(orderId: string, provider: string, returnUrl?: string, currentUser?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        items: { include: { product: { select: { title: true } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (currentUser) this.assertOwnerOrAdmin(currentUser, order.userId);

    const gatewayConfig = await this.gatewaysService.getGatewayConfig(provider);
    const gatewayProvider = this.gatewayFactory.getProvider(provider);

    const defaultReturnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/orders/${orderId}`;
    // CCAvenue posts its encrypted response to redirect_url/cancel_url. Those
    // URLs must reach this backend so the response is processed first.
    const effectiveReturnUrl = provider.toUpperCase() === 'CCAVENUE'
      ? this.getCcavenueCallbackUrl(gatewayConfig.webhookUrl)
      : returnUrl || defaultReturnUrl;

    let existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });

    // Duplicate-payment prevention: a payment already captured for this order can never be re-initiated.
    if (existingPayment?.status === PaymentStatus.CAPTURED) {
      throw new BadRequestException('Payment already completed for this order');
    }

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

    let result;
    try {
      result = await gatewayProvider.initiatePayment({
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
    } catch (err) {
      // Log the full error server-side (stack, provider, order) for debugging — the
      // client only ever sees the short, safe message below.
      this.logger.error(
        `Payment initiation failed for order ${orderId} via ${provider}: ${err.message}`,
        err.stack,
      );
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Could not initiate payment with ${provider}. Please try another payment method or contact support.`,
      );
    }

    // Persist the gateway-side order/session ref immediately so the verify/webhook
    // handlers can resolve this payment by looking up providerRef (e.g. Razorpay's order_id).
    if (result.providerOrderId) {
      await this.prisma.payment.update({
        where: { orderId },
        data: { provider, providerRef: result.providerOrderId },
      });
    }

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
      const payment = await this.prisma.payment.findUnique({
        where: { orderId: result.orderId },
        include: { order: true },
      });

      // Reconcile only the payment created during initiation; never create a
      // zero-value payment from an unsolicited gateway callback.
      if (!payment || payment.provider !== provider) {
        throw new BadRequestException('Payment not found for this gateway callback');
      }

      const callbackAmount = result.rawResponse?.amount;
      if (callbackAmount !== undefined && Number(callbackAmount) !== Number(payment.amount)) {
        throw new BadRequestException('Gateway callback amount does not match the order payment');
      }

      // CCAvenue may retry callbacks. A completed payment cannot be downgraded
      // by a delayed failed/aborted response.
      if (payment.status !== PaymentStatus.CAPTURED) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: result.paymentStatus, providerRef: result.providerRef || payment.providerRef },
        });

        await this.prisma.order.update({
          where: { id: result.orderId },
          data: { status: result.orderStatus },
        });

        if (result.paymentStatus === PaymentStatus.CAPTURED) {
          await this.notificationsService.createNotification(
            payment.order.userId,
            'PAYMENT',
            'Payment Successful',
            `Your payment for order #${payment.order.orderNumber} was received successfully.`,
          );
        }
      }
    }

    return result;
  }

  /**
   * Dedicated verification for the Razorpay JS-checkout modal flow: recomputes the
   * HMAC signature server-side and only then marks the payment CAPTURED / order CONFIRMED.
   */
  async verifyRazorpayPayment(currentUser: any, dto: RazorpayVerifyDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: dto.razorpay_order_id, provider: 'RAZORPAY' },
      include: { order: true },
    });

    if (!payment) throw new NotFoundException('Payment not found for this Razorpay order');

    this.assertOwnerOrAdmin(currentUser, payment.order.userId);

    // Idempotent: verification may already have happened via webhook.
    if (payment.status === PaymentStatus.CAPTURED) {
      return { success: true, payment, order: payment.order };
    }

    const gatewayConfig = await this.gatewaysService.getGatewayConfig('RAZORPAY');
    const expectedSignature = crypto
      .createHmac('sha256', gatewayConfig.credentials.keySecret)
      .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
      .digest('hex');

    const isValid = this.safeCompare(expectedSignature, dto.razorpay_signature);

    if (!isValid) {
      const existingMetadata = (payment.metadata as any) || {};
      const failedAttempts = Array.isArray(existingMetadata.failedAttempts) ? existingMetadata.failedAttempts : [];
      failedAttempts.push({ at: new Date().toISOString(), reason: 'signature_mismatch', razorpay_payment_id: dto.razorpay_payment_id });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, metadata: { ...existingMetadata, failedAttempts } },
      });

      throw new BadRequestException('Payment verification failed');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CAPTURED,
        providerRef: dto.razorpay_payment_id,
        metadata: {
          razorpayOrderId: dto.razorpay_order_id,
          razorpayPaymentId: dto.razorpay_payment_id,
          verifiedAt: new Date().toISOString(),
          verifiedVia: 'checkout',
        },
      },
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CONFIRMED },
    });

    await this.notificationsService.createNotification(
      payment.order.userId,
      'PAYMENT',
      'Payment Successful',
      `Your payment for order #${payment.order.orderNumber} was received successfully.`,
    );

    return { success: true, payment: updatedPayment, order: updatedOrder };
  }

  /**
   * Admin dashboard summary numbers for the Payments section.
   */
  async getStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, captured, pending, failed, refunded, todayRevenue, monthRevenue] = await Promise.all([
      this.prisma.payment.aggregate({ _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.CAPTURED }, _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.PENDING }, _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.FAILED }, _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.REFUNDED }, _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.CAPTURED, createdAt: { gte: startOfToday } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.CAPTURED, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    ]);

    const totalCount = total._count as unknown as number;
    const successfulCount = captured._count as unknown as number;

    return {
      totalPayments: totalCount,
      totalAmount: Number(total._sum.amount || 0),
      successfulPayments: successfulCount,
      successfulAmount: Number(captured._sum.amount || 0),
      pendingPayments: pending._count as unknown as number,
      pendingAmount: Number(pending._sum.amount || 0),
      failedPayments: failed._count as unknown as number,
      failedAmount: Number(failed._sum.amount || 0),
      refundedPayments: refunded._count as unknown as number,
      refundedAmount: Number(refunded._sum.amount || 0),
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      successRate: totalCount > 0 ? Number(((successfulCount / totalCount) * 100).toFixed(2)) : 0,
    };
  }

  /**
   * Razorpay webhook handler: verifies the header signature against the raw request
   * body, logs every event for idempotency + audit, and reconciles payment/refund state
   * independent of whether the client-side verify call ever ran.
   */
  async handleRazorpayWebhook(rawBody: Buffer, signatureHeader: string | undefined, eventIdHeader: string | undefined, payload: any) {
    const gatewayConfig = await this.gatewaysService.getGatewayConfig('RAZORPAY');
    const webhookSecret = gatewayConfig.credentials.webhookSecret;
    if (!webhookSecret) {
      throw new BadRequestException('Razorpay webhook secret is not configured');
    }

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!signatureHeader || !this.safeCompare(expectedSignature, signatureHeader)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventId = eventIdHeader || crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventType = payload?.event || 'unknown';

    let eventRow;
    try {
      eventRow = await this.prisma.paymentWebhookEvent.create({
        data: { provider: 'RAZORPAY', eventId, eventType, payload },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        // Already processed this exact event — Razorpay retries on non-2xx, so ack without reprocessing.
        return { duplicate: true };
      }
      throw err;
    }

    let resultStatus: 'PROCESSED' | 'FAILED' | 'IGNORED' = 'IGNORED';

    try {
      if (eventType === 'payment.captured' || eventType === 'payment.failed') {
        const entity = payload?.payload?.payment?.entity;
        const payment = entity?.order_id
          ? await this.prisma.payment.findFirst({ where: { providerRef: entity.order_id, provider: 'RAZORPAY' }, include: { order: true } })
          : null;

        if (payment && payment.status !== PaymentStatus.CAPTURED) {
          if (eventType === 'payment.captured') {
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.CAPTURED,
                providerRef: entity.id,
                metadata: {
                  razorpayOrderId: entity.order_id,
                  razorpayPaymentId: entity.id,
                  verifiedAt: new Date().toISOString(),
                  verifiedVia: 'webhook',
                },
              },
            });
            await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CONFIRMED } });
            await this.notificationsService.createNotification(
              payment.order.userId,
              'PAYMENT',
              'Payment Successful',
              `Your payment for order #${payment.order.orderNumber} was received successfully.`,
            );
          } else {
            await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
          }
          resultStatus = 'PROCESSED';
        }
      } else if (eventType === 'refund.processed' || eventType === 'refund.failed') {
        const entity = payload?.payload?.refund?.entity;
        const refund = entity?.id
          ? await this.prisma.refund.findFirst({ where: { razorpayRefundId: entity.id }, include: { payment: { include: { order: true, refunds: true } } } })
          : null;

        if (refund && refund.status !== RefundStatus.PROCESSED) {
          const newStatus = eventType === 'refund.processed' ? RefundStatus.PROCESSED : RefundStatus.FAILED;
          await this.prisma.refund.update({ where: { id: refund.id }, data: { status: newStatus, rawResponse: entity } });

          if (newStatus === RefundStatus.PROCESSED) {
            const totalRefunded = refund.payment.refunds
              .filter((r) => r.status === RefundStatus.PROCESSED || r.id === refund.id)
              .reduce((sum, r) => sum + Number(r.id === refund.id ? refund.amount : r.amount), 0);

            if (totalRefunded >= Number(refund.payment.amount)) {
              await this.prisma.payment.update({ where: { id: refund.payment.id }, data: { status: PaymentStatus.REFUNDED } });
              await this.prisma.order.update({ where: { id: refund.payment.orderId }, data: { status: OrderStatus.REFUNDED } });
            }

            await this.notificationsService.createNotification(
              refund.payment.order.userId,
              'PAYMENT',
              'Refund Processed',
              `Your refund of ${Number(refund.amount).toFixed(2)} ${refund.payment.currency} for order #${refund.payment.order.orderNumber} has been processed.`,
            );
          }
          resultStatus = 'PROCESSED';
        }
      }

      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventRow.id },
        data: { status: resultStatus, processedAt: new Date() },
      });
    } catch (err) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventRow.id },
        data: { status: 'FAILED', processedAt: new Date() },
      });
      throw err;
    }

    return { received: true };
  }

  /**
   * Initiate CCAvenue payment (backward compatible).
   */
  async initiateCcavenue(orderId: string, returnUrl: string, currentUser?: any) {
    return this.initiatePayment(orderId, 'CCAVENUE', returnUrl, currentUser);
  }

  /**
   * Handle CCAvenue callback (backward compatible).
   */
  async handleCcavenueCallback(encryptedResponse: string) {
    return this.handleCallback('CCAVENUE', { encResp: encryptedResponse });
  }

  private getCcavenueCallbackUrl(configuredUrl?: string): string {
    if (configuredUrl) return configuredUrl;

    const apiBaseUrl = process.env.PUBLIC_API_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${apiBaseUrl.replace(/\/$/, '')}/api/v1/payments/callback/CCAVENUE`;
  }
}
