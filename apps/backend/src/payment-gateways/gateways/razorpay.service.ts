import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentGatewayProvider, GatewayInitResponse, GatewayCallbackResult, GatewayRefundResult } from './gateway.interface';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayGatewayService implements PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.keyId && credentials.keySecret);
  }

  async initiatePayment(params: {
    orderId: string;
    amount: number;
    currency: string;
    customerInfo: { name: string; email: string; phone: string };
    returnUrl: string;
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<GatewayInitResponse> {
    const { orderId, amount, currency, customerInfo, credentials } = params;

    const razorpayOrder = await this.createRazorpayOrder(
      credentials.keyId,
      credentials.keySecret,
      amount,
      currency || 'INR',
      orderId,
    );

    return {
      providerOrderId: razorpayOrder.id,
      keyId: credentials.keyId,
      extra: {
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      },
    };
  }

  async handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return {
        orderId: '',
        providerRef: '',
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: 'PENDING',
        rawResponse: payload,
      };
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', credentials.keySecret)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    // Razorpay's JS-checkout flow is verified via the dedicated
    // POST /payments/razorpay/verify endpoint (PaymentsService.verifyRazorpayPayment),
    // which resolves the internal order via Payment.providerRef === razorpay_order_id.
    // This generic callback is only a fallback for redirect-based invocations and has no
    // way to resolve an internal order id on its own, so it intentionally no-ops.
    const orderId = '';

    if (isValid) {
      return {
        orderId,
        providerRef: razorpay_payment_id,
        paymentStatus: PaymentStatus.CAPTURED,
        orderStatus: 'CONFIRMED',
        rawResponse: payload,
      };
    } else {
      return {
        orderId,
        providerRef: razorpay_payment_id,
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: 'PENDING',
        rawResponse: payload,
      };
    }
  }

  getGatewayUrl(testMode: boolean): string {
    return 'https://api.razorpay.com/v1';
  }

  async refundPayment(params: {
    providerPaymentId: string;
    amount: number;
    credentials: Record<string, string>;
    notes?: Record<string, string>;
  }): Promise<GatewayRefundResult> {
    const { providerPaymentId, amount, credentials, notes } = params;
    const url = `https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64'),
        // Razorpay dedupes refund requests sharing the same idempotency key,
        // preventing a retried admin action from creating a second refund.
        'X-Razorpay-Idempotency-Key': (notes && notes.internalRefundId) || crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        speed: 'normal',
        notes: notes || {},
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new BadRequestException(`Razorpay refund failed: ${body?.error?.description || JSON.stringify(body)}`);
    }

    return {
      refundId: body.id,
      status: body.status === 'processed' ? 'PROCESSED' : body.status === 'failed' ? 'FAILED' : 'PENDING',
      rawResponse: body,
    };
  }

  private async createRazorpayOrder(
    keyId: string,
    keySecret: string,
    amount: number,
    currency: string,
    receipt: string,
  ): Promise<any> {
    const url = 'https://api.razorpay.com/v1/orders';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        receipt,
        payment_capture: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(`Razorpay order creation failed: ${errorBody}`);
    }

    return response.json();
  }
}