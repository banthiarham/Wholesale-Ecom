import { Injectable } from '@nestjs/common';
import { PaymentGatewayProvider, GatewayInitResponse, GatewayCallbackResult } from './gateway.interface';
import { PaymentStatus } from '@prisma/client';

/**
 * Generic redirect-based gateway for custom payment providers.
 * Uses the gatewayUrl from the PaymentGateway config and sends
 * credentials + order info as form data to the gateway URL.
 */
@Injectable()
export class CustomGatewayService implements PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    // At least one credential field must be provided
    return Object.keys(credentials).length > 0;
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

    // Build form data from credentials plus standard fields
    const formData: Record<string, string> = {
      order_id: orderId,
      amount: String(Math.round(amount * 100) / 100),
      currency,
      customer_name: customerInfo.name || '',
      customer_email: customerInfo.email || '',
      customer_phone: customerInfo.phone || '',
      return_url: returnUrl,
      ...credentials,
    };

    return { formData };
  }

  async handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult> {
    const orderId = payload.order_id || payload.orderId || payload.merchantOrderId || '';
    const providerRef = payload.transaction_id || payload.txn_id || payload.payment_id || payload.ref || '';
    const status = (payload.status || payload.payment_status || '').toString().toLowerCase();

    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    let orderStatus: 'CONFIRMED' | 'PENDING' = 'PENDING';

    if (['success', 'captured', 'completed', 'paid'].includes(status)) {
      paymentStatus = PaymentStatus.CAPTURED;
      orderStatus = 'CONFIRMED';
    } else if (['failed', 'failure', 'error', 'declined'].includes(status)) {
      paymentStatus = PaymentStatus.FAILED;
    } else if (['refunded', 'refund'].includes(status)) {
      paymentStatus = PaymentStatus.REFUNDED;
    } else if (['cancelled', 'canceled', 'cancelled'].includes(status)) {
      paymentStatus = PaymentStatus.CANCELLED;
    }

    return {
      orderId,
      providerRef,
      paymentStatus,
      orderStatus,
      rawResponse: payload,
    };
  }

  getGatewayUrl(testMode: boolean): string {
    // Custom gateways use the gatewayUrl from the PaymentGateway config
    return '';
  }
}