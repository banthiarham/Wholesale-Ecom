import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

/**
 * CCAvenue Payment Gateway Integration
 *
 * Uses AES-128-CBC encryption with the merchant working key.
 * Reference: https://developer.ccavenue.com/docs
 */
@Injectable()
export class CcavenueService {
  private merchantId: string;
  private accessCode: string;
  private workingKey: string;
  private gatewayUrl: string;

  constructor(private configService: ConfigService) {
    this.merchantId = this.configService.get<string>('CCAVENUE_MERCHANT_ID', '');
    this.accessCode = this.configService.get<string>('CCAVENUE_ACCESS_CODE', '');
    this.workingKey = this.configService.get<string>('CCAVENUE_WORKING_KEY', '');
    this.gatewayUrl = this.configService.get<string>(
      'CCAVENUE_GATEWAY_URL',
      'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction',
    );
  }

  /**
   * Encrypt plain text using AES-128-CBC with the working key.
   * CCAvenue expects this exact algorithm for the request data.
   */
  encrypt(plainText: string): string {
    const key = CryptoJS.enc.Hex.parse(CryptoJS.MD5(this.workingKey).toString());
    const iv = this.getInitializationVector();
    const encrypted = CryptoJS.AES.encrypt(plainText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }

  /**
   * Decrypt CCAvenue response using AES-128-CBC with the working key.
   */
  decrypt(cipherText: string): string {
    const key = CryptoJS.enc.Hex.parse(CryptoJS.MD5(this.workingKey).toString());
    const iv = this.getInitializationVector();
    const decrypted = CryptoJS.AES.decrypt(cipherText, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Build the CCAvenue request payload string.
   */
  buildRequestPayload(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  /**
   * Parse the decrypted CCAvenue response string into a key-value object.
   */
  parseResponse(responseStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const pair of responseStr.split('&')) {
      const [key, value] = pair.split('=');
      if (key) result[key] = decodeURIComponent(value || '');
    }
    return result;
  }

  getConfig() {
    return {
      merchantId: this.merchantId,
      accessCode: this.accessCode,
      gatewayUrl: this.gatewayUrl,
    };
  }

  private getInitializationVector(): CryptoJS.lib.WordArray {
    return CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
  }
}
