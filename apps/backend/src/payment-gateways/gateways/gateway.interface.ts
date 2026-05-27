import { PaymentStatus } from '@prisma/client';

export interface GatewayInitResponse {
  redirectUrl?: string;
  formData?: Record<string, string>;
  providerOrderId?: string;
  keyId?: string;
  extra?: Record<string, any>;
}

export interface GatewayCallbackResult {
  orderId: string;
  providerRef: string;
  paymentStatus: PaymentStatus;
  orderStatus: 'CONFIRMED' | 'PENDING';
  rawResponse?: any;
}

export interface PaymentGatewayProvider {
  validateCredentials(credentials: Record<string, string>): boolean;
  initiatePayment(params: {
    orderId: string;
    amount: number;
    currency: string;
    customerInfo: { name: string; email: string; phone: string };
    returnUrl: string;
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<GatewayInitResponse>;
  handleCallback(payload: any, credentials: Record<string, string>, testMode: boolean): Promise<GatewayCallbackResult>;
  getGatewayUrl(testMode: boolean): string;
}