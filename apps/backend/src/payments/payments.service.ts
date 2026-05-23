import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { CcavenueService } from './ccavenue.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ccavenueService: CcavenueService,
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
    return this.prisma.payment.findUnique({ where: { orderId } });
  }

  /**
   * Initiate CCAvenue payment for an order.
   * Returns encrypted data and config needed by the frontend to redirect to CCAvenue.
   */
  async initiateCcavenue(orderId: string, returnUrl: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        items: { include: { product: { select: { title: true } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    const config = this.ccavenueService.getConfig();
    if (!config.merchantId || !config.accessCode) {
      throw new BadRequestException('CCAvenue is not configured');
    }

    // Create or update payment record
    const existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!existingPayment) {
      await this.prisma.payment.create({
        data: {
          orderId,
          provider: 'CCAVENUE',
          amount: Number(order.totalAmount),
          status: PaymentStatus.PENDING,
        },
      });
    }

    const itemNames = order.items.map((i) => i.product.title).join(', ').substring(0, 255);

    const requestParams = {
      merchant_id: config.merchantId,
      order_id: order.id,
      currency: 'INR',
      amount: String(order.totalAmount),
      redirect_url: returnUrl,
      cancel_url: returnUrl,
      language: 'EN',
      billing_name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'Customer',
      billing_email: order.user.email || '',
      billing_tel: order.user.phone || '',
      delivery_name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || 'Customer',
      delivery_email: order.user.email || '',
      delivery_tel: order.user.phone || '',
      merchant_param1: order.id,
      merchant_param2: 'wholesalex-order',
      ...(itemNames ? { merchant_param3: itemNames } : {}),
    };

    const plainText = this.ccavenueService.buildRequestPayload(requestParams);
    const encRequest = this.ccavenueService.encrypt(plainText);

    return {
      accessCode: config.accessCode,
      encRequest,
      gatewayUrl: config.gatewayUrl,
      orderId: order.id,
    };
  }

  /**
   * Handle CCAvenue callback response.
   * Decrypts the response, updates payment and order status.
   */
  async handleCcavenueCallback(encryptedResponse: string) {
    if (!encryptedResponse) {
      throw new BadRequestException('Missing encrypted response');
    }

    const decrypted = this.ccavenueService.decrypt(encryptedResponse);
    if (!decrypted) {
      throw new BadRequestException('Failed to decrypt CCAvenue response');
    }

    const response = this.ccavenueService.parseResponse(decrypted);

    const orderId = response.merchant_param1 || response.order_id;
    const trackingId = response.tracking_id;
    const bankRefNo = response.bank_ref_no;
    const orderStatus = response.order_status; // Success / Aborted / Failure
    const failureMessage = response.failure_message;
    const paymentMode = response.payment_mode;
    const amount = response.amount;

    if (!orderId) {
      throw new BadRequestException('Order ID not found in CCAvenue response');
    }

    let paymentStatus: PaymentStatus;
    let orderStatusUpdate: OrderStatus;

    if (orderStatus === 'Success') {
      paymentStatus = PaymentStatus.CAPTURED;
      orderStatusUpdate = OrderStatus.CONFIRMED;
    } else if (orderStatus === 'Aborted') {
      paymentStatus = PaymentStatus.CANCELLED;
      orderStatusUpdate = OrderStatus.PENDING;
    } else {
      paymentStatus = PaymentStatus.FAILED;
      orderStatusUpdate = OrderStatus.PENDING;
    }

    await this.prisma.payment.upsert({
      where: { orderId },
      update: {
        status: paymentStatus,
        providerRef: trackingId || bankRefNo || null,
        amount: amount ? Number(amount) : undefined,
      },
      create: {
        orderId,
        provider: 'CCAVENUE',
        providerRef: trackingId || bankRefNo || null,
        amount: amount ? Number(amount) : 0,
        status: paymentStatus,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatusUpdate },
    });

    return {
      orderId,
      status: orderStatus,
      paymentStatus,
      trackingId,
      failureMessage,
      paymentMode,
      amount,
    };
  }
}
