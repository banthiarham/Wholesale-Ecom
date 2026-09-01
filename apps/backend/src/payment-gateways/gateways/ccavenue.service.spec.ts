import * as crypto from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { CcavenueGatewayService } from './ccavenue.service';

const workingKey = 'test-working-key';
const credentials = {
  merchantId: 'merchant-123',
  accessCode: 'access-123',
  workingKey,
};

function encryptAsCcavenue(plainText: string): string {
  const key = crypto.createHash('md5').update(workingKey).digest();
  const iv = Buffer.from([...Array(16).keys()]);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('base64');
}

function decryptAsCcavenue(cipherText: string): string {
  const key = crypto.createHash('md5').update(workingKey).digest();
  const iv = Buffer.from([...Array(16).keys()]);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(cipherText, 'base64'), decipher.final()]).toString('utf8');
}

describe('CcavenueGatewayService', () => {
  const service = new CcavenueGatewayService();

  it('creates a CCAvenue-compatible encrypted initiation payload', async () => {
    const result = await service.initiatePayment({
      orderId: 'order-123',
      amount: 1250.5,
      currency: 'INR',
      customerInfo: { name: 'Test Buyer', email: 'buyer@example.com', phone: '9876543210' },
      returnUrl: 'https://api.example.com/api/v1/payments/callback/CCAVENUE',
      credentials,
      testMode: true,
    });

    expect(result.redirectUrl).toBe('https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction');
    expect(result.formData?.access_code).toBe(credentials.accessCode);
    expect(decryptAsCcavenue(result.formData!.encRequest)).toContain('merchant_id=merchant-123');
    expect(decryptAsCcavenue(result.formData!.encRequest)).toContain('redirect_url=https%3A%2F%2Fapi.example.com%2Fapi%2Fv1%2Fpayments%2Fcallback%2FCCAVENUE');
  });

  it.each([
    ['Success', PaymentStatus.CAPTURED, 'CONFIRMED'],
    ['Aborted', PaymentStatus.CANCELLED, 'PENDING'],
    ['Failure', PaymentStatus.FAILED, 'PENDING'],
  ])('decrypts and maps a %s callback', async (gatewayStatus, paymentStatus, orderStatus) => {
    const encResp = encryptAsCcavenue(
      `order_id=order-123&merchant_param1=order-123&tracking_id=track-123&amount=1250.50&order_status=${gatewayStatus}`,
    );

    await expect(service.handleCallback({ encResp }, credentials, true)).resolves.toMatchObject({
      orderId: 'order-123',
      providerRef: 'track-123',
      paymentStatus,
      orderStatus,
    });
  });
});
