import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayFactory } from './gateways/gateway.factory';
import * as CryptoJS from 'crypto-js';

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

    return this.prisma.paymentGateway.delete({ where: { id } });
  }

  async findAll() {
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