import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentGatewayProvider, GatewayInitResponse, GatewayCallbackResult } from './gateway.interface';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class StripeGatewayService implements PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.secretKey);
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
    const { orderId, amount, currency, customerInfo, returnUrl, credentials } = params;

    const session = await this.createCheckoutSession(
      credentials.secretKey,
      orderId,
      amount,
      currency || 'inr',
      customerInfo,
      returnUrl,
    );

    return {
      redirectUrl: session.url,
      providerOrderId: session.id,
    };
  }

  async handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult> {
    const sessionId = payload.session_id;
    const orderId = payload.orderId || '';

    if (!sessionId) {
      return {
        orderId,
        providerRef: '',
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: 'PENDING',
        rawResponse: payload,
      };
    }

    const session = await this.retrieveSession(credentials.secretKey, sessionId);

    if (session.payment_status === 'paid') {
      return {
        orderId,
        providerRef: session.payment_intent as string || sessionId,
        paymentStatus: PaymentStatus.CAPTURED,
        orderStatus: 'CONFIRMED',
        rawResponse: payload,
      };
    }

    return {
      orderId,
      providerRef: sessionId,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: 'PENDING',
      rawResponse: payload,
    };
  }

  getGatewayUrl(testMode: boolean): string {
    return 'https://checkout.stripe.com';
  }

  private async createCheckoutSession(
    secretKey: string,
    orderId: string,
    amount: number,
    currency: string,
    customerInfo: { name: string; email: string; phone: string },
    returnUrl: string,
  ): Promise<any> {
    const url = 'https://api.stripe.com/v1/checkout/sessions';
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${returnUrl}?payment=cancelled`);
    params.append('client_reference_id', orderId);
    params.append('line_items[0][price_data][currency]', currency);
    params.append('line_items[0][price_data][product_data][name]', `Order #${orderId.slice(0, 8)}`);
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
    params.append('line_items[0][quantity]', '1');

    if (customerInfo.email) {
      params.append('customer_email', customerInfo.email);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(`Stripe session creation failed: ${errorBody}`);
    }

    return response.json();
  }

  private async retrieveSession(secretKey: string, sessionId: string): Promise<any> {
    const url = `https://api.stripe.com/v1/checkout/sessions/${sessionId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!response.ok) {
      throw new BadRequestException(`Stripe session retrieval failed`);
    }

    return response.json();
  }
}