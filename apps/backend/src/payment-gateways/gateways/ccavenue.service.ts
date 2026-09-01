import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { PaymentGatewayProvider, GatewayInitResponse, GatewayCallbackResult } from './gateway.interface';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class CcavenueGatewayService implements PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.merchantId && credentials.accessCode && credentials.workingKey);
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

    const requestParams: Record<string, string> = {
      merchant_id: credentials.merchantId,
      order_id: orderId,
      currency: currency || 'INR',
      amount: String(amount),
      redirect_url: returnUrl,
      cancel_url: returnUrl,
      language: 'EN',
      billing_name: customerInfo.name || 'Customer',
      billing_email: customerInfo.email || '',
      billing_tel: customerInfo.phone || '',
      delivery_name: customerInfo.name || 'Customer',
      delivery_email: customerInfo.email || '',
      delivery_tel: customerInfo.phone || '',
      merchant_param1: orderId,
      merchant_param2: 'wholesalex-order',
    };

    const plainText = this.buildRequestPayload(requestParams);
    const encRequest = this.encrypt(plainText, credentials.workingKey);
    const gatewayUrl = this.getGatewayUrl(testMode);

    return {
      redirectUrl: gatewayUrl,
      // CCAvenue's hosted form expects this snake_case field name.
      formData: { access_code: credentials.accessCode, encRequest },
    };
  }

  async handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult> {
    const encryptedResponse = typeof payload === 'string' ? payload : payload?.encResp || payload?.body?.encResp;
    if (!encryptedResponse) {
      throw new Error('Missing encrypted response from CCAvenue');
    }

    const decrypted = this.decrypt(encryptedResponse, credentials.workingKey);
    if (!decrypted) {
      throw new Error('Failed to decrypt CCAvenue response');
    }

    const response = this.parseResponse(decrypted);
    const orderId = response.merchant_param1 || response.order_id;
    const trackingId = response.tracking_id;
    const bankRefNo = response.bank_ref_no;
    const orderStatus = response.order_status;
    const paymentAmount = response.amount;

    let paymentStatus: PaymentStatus;
    let orderStatusResult: 'CONFIRMED' | 'PENDING';

    if (orderStatus === 'Success') {
      paymentStatus = PaymentStatus.CAPTURED;
      orderStatusResult = 'CONFIRMED';
    } else if (orderStatus === 'Aborted') {
      paymentStatus = PaymentStatus.CANCELLED;
      orderStatusResult = 'PENDING';
    } else {
      paymentStatus = PaymentStatus.FAILED;
      orderStatusResult = 'PENDING';
    }

    return {
      orderId,
      providerRef: trackingId || bankRefNo || '',
      paymentStatus,
      orderStatus: orderStatusResult,
      rawResponse: response,
    };
  }

  getGatewayUrl(testMode: boolean): string {
    return testMode
      ? 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
      : 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction';
  }

  private encrypt(plainText: string, workingKey: string): string {
    const key = CryptoJS.enc.Hex.parse(CryptoJS.MD5(workingKey).toString());
    const iv = this.getInitializationVector();
    const encrypted = CryptoJS.AES.encrypt(plainText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }

  private decrypt(cipherText: string, workingKey: string): string {
    const key = CryptoJS.enc.Hex.parse(CryptoJS.MD5(workingKey).toString());
    const iv = this.getInitializationVector();
    const decrypted = CryptoJS.AES.decrypt(cipherText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  private buildRequestPayload(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  private parseResponse(responseStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const pair of responseStr.split('&')) {
      const [key, value] = pair.split('=');
      if (key) result[key] = decodeURIComponent(value || '');
    }
    return result;
  }

  /**
   * CCAvenue's AES-128-CBC kit specifies the literal byte sequence 00..0f as
   * the IV. CryptoJS WordArrays contain 32-bit words, so constructing one from
   * character codes produces a different IV and unreadable CCAvenue payloads.
   */
  private getInitializationVector(): CryptoJS.lib.WordArray {
    return CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
  }
}
