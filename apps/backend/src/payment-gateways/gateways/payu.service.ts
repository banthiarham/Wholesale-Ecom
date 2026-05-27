import { Injectable } from '@nestjs/common';
import { PaymentGatewayProvider, GatewayInitResponse, GatewayCallbackResult } from './gateway.interface';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PayuGatewayService implements PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.merchantKey && credentials.salt);
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
    const { orderId, amount, currency, customerInfo, returnUrl, credentials, testMode } = params;
    const successUrl = credentials.successUrl || returnUrl;
    const failureUrl = credentials.failureUrl || returnUrl;

    const hash = this.generateHash(
      credentials.merchantKey,
      String(amount),
      orderId,
      credentials.salt,
      customerInfo.email || '',
    );

    const formData: Record<string, string> = {
      key: credentials.merchantKey,
      txnid: orderId,
      amount: String(amount),
      productinfo: credentials.productInfo || `Order #${orderId.slice(0, 8)}`,
      firstname: customerInfo.name || 'Customer',
      email: customerInfo.email || '',
      phone: customerInfo.phone || '',
      surl: successUrl,
      furl: failureUrl,
      hash,
    };

    return {
      redirectUrl: this.getGatewayUrl(testMode),
      formData,
    };
  }

  async handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult> {
    const { txnid, status, mihpayid, hash: responseHash } = payload;
    const orderId = txnid || payload.orderId || '';

    if (!responseHash || !txnid) {
      return {
        orderId,
        providerRef: '',
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: 'PENDING',
        rawResponse: payload,
      };
    }

    const expectedHash = this.generateResponseHash(
      credentials.salt,
      status,
      mihpayid || '',
      txnid,
      String(payload.amount || ''),
      payload.productinfo || '',
      payload.firstname || '',
      payload.email || '',
      credentials.merchantKey,
    );

    if (status === 'success' && responseHash === expectedHash) {
      return {
        orderId,
        providerRef: mihpayid || txnid,
        paymentStatus: PaymentStatus.CAPTURED,
        orderStatus: 'CONFIRMED',
        rawResponse: payload,
      };
    }

    if (status === 'failure') {
      return {
        orderId,
        providerRef: mihpayid || txnid,
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: 'PENDING',
        rawResponse: payload,
      };
    }

    return {
      orderId,
      providerRef: mihpayid || txnid,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: 'PENDING',
      rawResponse: payload,
    };
  }

  getGatewayUrl(testMode: boolean): string {
    return testMode
      ? 'https://test.payu.in/_payment'
      : 'https://secure.payu.in/_payment';
  }

  private generateHash(key: string, amount: string, txnid: string, salt: string, email: string): string {
    const str = `${key}|${txnid}|${amount}|WholesaleX Order|${email}|${salt}`;
    return crypto.createHash('sha512').update(str).digest('hex');
  }

  private generateResponseHash(
    salt: string,
    status: string,
    mihpayid: string,
    txnid: string,
    amount: string,
    productinfo: string,
    firstname: string,
    email: string,
    key: string,
  ): string {
    const str = `${salt}|${status}|||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    return crypto.createHash('sha512').update(str).digest('hex');
  }
}