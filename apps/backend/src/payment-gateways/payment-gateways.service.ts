import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayFactory } from './gateways/gateway.factory';
import * as CryptoJS from 'crypto-js';

/** Built-in "offline" payment methods: they have no API credentials and never go through a gateway redirect. */
export const COD_PROVIDER = 'COD';
export const BANK_TRANSFER_PROVIDER = 'BANK_TRANSFER';
const OFFLINE_PROVIDERS = [COD_PROVIDER, BANK_TRANSFER_PROVIDER];
/** Bank details the admin fills in for Bank Transfer (stored in the gateway's `settings`, shown to customers at checkout). */
const BANK_FIELDS: { key: string; label: string }[] = [
  { key: 'bankName', label: 'Bank name' },
  { key: 'accountName', label: 'Account name' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'ifscCode', label: 'IFSC code' },
  { key: 'branch', label: 'Branch' },
];

@Injectable()
export class PaymentGatewaysService {
  private encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private factory: PaymentGatewayFactory,
  ) {
    this.encryptionKey = this.configService.get<string>('GATEWAY_CREDENTIALS_KEY', 'default-encryption-key-change-in-production-32bytes');
  }

  /** Cash on Delivery always exists as a built-in method (enabled by default) so admins can switch it on/off. */
  private async ensureCodGateway() {
    const existing = await this.prisma.paymentGateway.findUnique({ where: { provider: COD_PROVIDER } });
    if (existing) return existing;
    return this.prisma.paymentGateway.create({
      data: {
        provider: COD_PROVIDER,
        label: 'Cash on Delivery',
        description: 'Pay when your order arrives',
        isActive: true,
        isDefault: false,
        testMode: false,
      },
    });
  }

  private cleanBankDetails(settings?: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of BANK_FIELDS) {
      const v = String(settings?.[f.key] ?? '').trim();
      if (!v) throw new BadRequestException(`${f.label} is required for Bank Transfer`);
      out[f.key] = v;
    }
    return out;
  }

  async create(data: {
    provider: string;
    label: string;
    description?: string;
    isActive: boolean;
    isDefault: boolean;
    testMode: boolean;
    credentials: Record<string, string>;
    credentialFields?: { key: string; label: string; required: boolean }[];
    gatewayUrl?: string;
    webhookUrl?: string;
    settings?: Record<string, any>;
  }) {
    const providerName = data.provider.toUpperCase();

    if (providerName === COD_PROVIDER) {
      throw new BadRequestException('Cash on Delivery is built in. Enable or disable it from the gateway list instead of adding it.');
    }

    if (providerName === BANK_TRANSFER_PROVIDER) {
      return this.prisma.paymentGateway.create({
        data: {
          provider: providerName,
          label: data.label,
          description: data.description,
          isActive: data.isActive,
          isDefault: false,
          testMode: false,
          settings: this.cleanBankDetails(data.settings),
        },
      });
    }

    const provider = this.factory.getProvider(providerName);
    if (!provider.validateCredentials(data.credentials)) {
      throw new BadRequestException(`Invalid credentials for ${providerName}. Required fields are missing.`);
    }

    if (data.isDefault) {
      await this.prisma.paymentGateway.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const encrypted = this.encryptCredentials(data.credentials);

    return this.prisma.paymentGateway.create({
      data: {
        provider: providerName,
        label: data.label,
        description: data.description,
        isActive: data.isActive,
        isDefault: data.isDefault,
        testMode: data.testMode,
        credentials: encrypted,
        credentialFields: data.credentialFields || undefined,
        gatewayUrl: data.gatewayUrl || undefined,
        webhookUrl: data.webhookUrl || undefined,
        settings: data.settings || undefined,
      },
    });
  }

  async update(id: string, data: {
    label?: string;
    description?: string;
    isActive?: boolean;
    isDefault?: boolean;
    testMode?: boolean;
    credentials?: Record<string, string>;
    credentialFields?: { key: string; label: string; required: boolean }[];
    gatewayUrl?: string;
    webhookUrl?: string;
    settings?: Record<string, any>;
  }) {
    const gateway = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');

    if (OFFLINE_PROVIDERS.includes(gateway.provider)) {
      // Offline methods only have a label, description, on/off switch and (for bank transfer) bank details.
      const offline: any = {};
      if (data.label !== undefined) offline.label = data.label;
      if (data.description !== undefined) offline.description = data.description;
      if (data.isActive !== undefined) offline.isActive = data.isActive;
      if (gateway.provider === BANK_TRANSFER_PROVIDER && data.settings !== undefined) {
        offline.settings = this.cleanBankDetails(data.settings);
      }
      return this.prisma.paymentGateway.update({ where: { id }, data: offline });
    }

    if (data.isDefault) {
      await this.prisma.paymentGateway.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.testMode !== undefined) updateData.testMode = data.testMode;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.credentialFields !== undefined) updateData.credentialFields = data.credentialFields;
    if (data.gatewayUrl !== undefined) updateData.gatewayUrl = data.gatewayUrl;
    if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;

    if (data.credentials) {
      const provider = this.factory.getProvider(gateway.provider);
      if (!provider.validateCredentials(data.credentials)) {
        throw new BadRequestException(`Invalid credentials for ${gateway.provider}. Required fields are missing.`);
      }
      updateData.credentials = this.encryptCredentials(data.credentials);
    }

    return this.prisma.paymentGateway.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const gateway = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');
    if (gateway.provider === COD_PROVIDER) {
      throw new BadRequestException('Cash on Delivery cannot be deleted. Disable it instead.');
    }

    return this.prisma.paymentGateway.delete({ where: { id } });
  }

  async findAll() {
    await this.ensureCodGateway();
    const gateways = await this.prisma.paymentGateway.findMany({ orderBy: { label: 'asc' } });
    return gateways.map((gw) => ({
      ...gw,
      credentials: gw.credentials ? this.maskCredentials(this.decryptCredentials(String(gw.credentials))) : {},
    }));
  }

  async findOne(id: string) {
    const gateway = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) throw new NotFoundException('Payment gateway not found');
    return {
      ...gateway,
      credentials: gateway.credentials ? this.maskCredentials(this.decryptCredentials(String(gateway.credentials))) : {},
    };
  }

  async getEnabledGateways() {
    await this.ensureCodGateway();
    const gateways = await this.prisma.paymentGateway.findMany({
      where: { isActive: true },
      select: {
        id: true,
        provider: true,
        label: true,
        description: true,
        isDefault: true,
        testMode: true,
        gatewayUrl: true,
        settings: true,
      },
    });
    return gateways;
  }

  async getGatewayConfig(provider: string): Promise<{
    credentials: Record<string, string>;
    testMode: boolean;
    gatewayUrl: string;
    gatewayId: string;
    webhookUrl?: string;
  }> {
    const dbRecord = await this.prisma.paymentGateway.findUnique({
      where: { provider },
    });

    if (dbRecord && dbRecord.isActive && dbRecord.credentials) {
      const credentials = this.decryptCredentials(String(dbRecord.credentials));
      const providerInstance = this.factory.getProvider(provider);
      const builtinUrl = providerInstance.getGatewayUrl(dbRecord.testMode);
      return {
        credentials,
        testMode: dbRecord.testMode,
        gatewayUrl: dbRecord.gatewayUrl || builtinUrl,
        gatewayId: dbRecord.id,
        webhookUrl: dbRecord.webhookUrl || undefined,
      };
    }

    // Fallback to env vars for CCAvenue (migration path)
    if (provider === 'CCAVENUE') {
      const credentials = {
        merchantId: this.configService.get('CCAVENUE_MERCHANT_ID', ''),
        accessCode: this.configService.get('CCAVENUE_ACCESS_CODE', ''),
        workingKey: this.configService.get('CCAVENUE_WORKING_KEY', ''),
      };
      if (!credentials.merchantId || !credentials.accessCode || !credentials.workingKey) {
        throw new BadRequestException('CCAvenue is not configured. Configure it in Payment Gateways settings.');
      }
      return {
        credentials,
        testMode: true,
        gatewayUrl: this.configService.get('CCAVENUE_GATEWAY_URL', 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction'),
        gatewayId: 'env-fallback',
        webhookUrl: this.configService.get('CCAVENUE_CALLBACK_URL', '') || undefined,
      };
    }

    throw new BadRequestException(`${provider} gateway is not configured. Enable it in Payment Gateways settings.`);
  }

  private encryptCredentials(credentials: Record<string, string>): string {
    const json = JSON.stringify(credentials);
    return CryptoJS.AES.encrypt(json, this.encryptionKey).toString();
  }

  private decryptCredentials(encrypted: string): Record<string, string> {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
      const json = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(json);
    } catch {
      throw new BadRequestException('Failed to decrypt gateway credentials. Check GATEWAY_CREDENTIALS_KEY.');
    }
  }

  private maskCredentials(credentials: Record<string, string>): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (value.length <= 8) {
        masked[key] = '****';
      } else {
        masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
      }
    }
    return masked;
  }
}
