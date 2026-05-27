import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DeliveryPartnerFactory } from './providers/partner.factory';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class DeliveryPartnersService {
  private encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private factory: DeliveryPartnerFactory,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'DELIVERY_PARTNER_CREDENTIALS_KEY',
      'default-delivery-key-change-in-production-32bytes',
    );
  }

  async findAll(activeOnly = false) {
    const partners = await this.prisma.deliveryPartner.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { orders: true } } },
    });
    return partners.map((p) => ({
      ...p,
      credentials: p.credentials ? this.maskCredentials(this.decryptCredentials(String(p.credentials))) : null,
    }));
  }

  async findById(id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    return {
      ...partner,
      credentials: partner.credentials ? this.maskCredentials(this.decryptCredentials(String(partner.credentials))) : null,
    };
  }

  async create(data: {
    name: string;
    code: string;
    trackingUrlTemplate?: string;
    contactEmail?: string;
    contactPhone?: string;
    logo?: string;
    isActive?: boolean;
    apiEnabled?: boolean;
    credentials?: Record<string, string>;
    credentialFields?: { key: string; label: string; required: boolean }[];
    apiBaseUrl?: string;
    testMode?: boolean;
    webhookUrl?: string;
    settings?: Record<string, any>;
  }) {
    const createData: any = {
      name: data.name,
      code: data.code,
      trackingUrlTemplate: data.trackingUrlTemplate || undefined,
      contactEmail: data.contactEmail || undefined,
      contactPhone: data.contactPhone || undefined,
      logo: data.logo || undefined,
      isActive: data.isActive ?? true,
      apiEnabled: data.apiEnabled ?? false,
      testMode: data.testMode ?? true,
      apiBaseUrl: data.apiBaseUrl || undefined,
      webhookUrl: data.webhookUrl || undefined,
      settings: data.settings || undefined,
      credentialFields: data.credentialFields || undefined,
    };

    if (data.apiEnabled && data.credentials) {
      const provider = this.factory.getProvider(data.code);
      if (!provider.validateCredentials(data.credentials)) {
        throw new BadRequestException(`Invalid credentials for ${data.code}. Required fields are missing.`);
      }
      createData.credentials = this.encryptCredentials(data.credentials);
    }

    return this.prisma.deliveryPartner.create({ data: createData });
  }

  async update(id: string, data: {
    name?: string;
    code?: string;
    trackingUrlTemplate?: string;
    contactEmail?: string;
    contactPhone?: string;
    logo?: string;
    isActive?: boolean;
    apiEnabled?: boolean;
    credentials?: Record<string, string>;
    credentialFields?: { key: string; label: string; required: boolean }[];
    apiBaseUrl?: string;
    testMode?: boolean;
    webhookUrl?: string;
    settings?: Record<string, any>;
  }) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.trackingUrlTemplate !== undefined) updateData.trackingUrlTemplate = data.trackingUrlTemplate;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.apiEnabled !== undefined) updateData.apiEnabled = data.apiEnabled;
    if (data.testMode !== undefined) updateData.testMode = data.testMode;
    if (data.apiBaseUrl !== undefined) updateData.apiBaseUrl = data.apiBaseUrl;
    if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.credentialFields !== undefined) updateData.credentialFields = data.credentialFields;

    if (data.credentials) {
      const code = data.code || partner.code;
      const provider = this.factory.getProvider(code);
      if (!provider.validateCredentials(data.credentials)) {
        throw new BadRequestException(`Invalid credentials for ${code}. Required fields are missing.`);
      }
      updateData.credentials = this.encryptCredentials(data.credentials);
      updateData.apiEnabled = true;
    }

    return this.prisma.deliveryPartner.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    const orderCount = await this.prisma.order.count({ where: { deliveryPartnerId: id } });
    if (orderCount > 0) {
      return this.prisma.deliveryPartner.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.deliveryPartner.delete({ where: { id } });
  }

  async getStats() {
    const [total, active, byOrderCount] = await Promise.all([
      this.prisma.deliveryPartner.count(),
      this.prisma.deliveryPartner.count({ where: { isActive: true } }),
      this.prisma.deliveryPartner.findMany({
        select: { id: true, name: true, _count: { select: { orders: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { total, active, partners: byOrderCount };
  }

  async getPartnerConfig(code: string): Promise<{
    credentials: Record<string, string>;
    testMode: boolean;
    apiBaseUrl: string;
    partnerId: string;
    settings: Record<string, any>;
  }> {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { code } });
    if (!partner || !partner.isActive || !partner.apiEnabled || !partner.credentials) {
      throw new BadRequestException(`${code} is not configured for API integration. Enable it in Delivery Partners settings.`);
    }

    const credentials = this.decryptCredentials(String(partner.credentials));
    const provider = this.factory.getProvider(code);
    const builtinUrl = provider.getApiUrl(partner.testMode);

    return {
      credentials,
      testMode: partner.testMode,
      apiBaseUrl: (partner.apiBaseUrl as string) || builtinUrl,
      partnerId: partner.id,
      settings: (partner.settings as Record<string, any>) || {},
    };
  }

  async testConnection(id: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.apiEnabled || !partner.credentials) {
      return { success: false, message: 'API integration not configured for this partner' };
    }

    try {
      const credentials = this.decryptCredentials(String(partner.credentials));
      const provider = this.factory.getProvider(partner.code);
      const valid = provider.validateCredentials(credentials);
      if (!valid) {
        return { success: false, message: 'Invalid credentials' };
      }
      return { success: true, message: `Successfully connected to ${partner.name} API` };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async createShipment(partnerId: string, orderId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.apiEnabled || !partner.credentials) {
      throw new BadRequestException('API integration not enabled for this partner');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { title: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const credentials = this.decryptCredentials(String(partner.credentials));
    const provider = this.factory.getProvider(partner.code);

    try {
      const result = await provider.createShipment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        senderAddress: null,
        receiverAddress: order.shippingAddress,
        packageDetails: {
          weight: 0.5,
          items: (order as any).items.map((i: any) => ({ title: i.product.title, quantity: i.quantity })),
        },
        credentials,
        testMode: partner.testMode,
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber: result.waybill,
          carrier: partner.name,
          deliveryPartnerId: partnerId,
        },
      });

      const existingTracking = await this.prisma.deliveryTracking.findUnique({ where: { orderId } });
      if (!existingTracking) {
        await this.prisma.deliveryTracking.create({
          data: {
            orderId,
            status: 'PENDING',
            currentLocation: result.estimatedDelivery ? undefined : undefined,
            estimatedDelivery: result.estimatedDelivery ? new Date(result.estimatedDelivery) : undefined,
          },
        });
      }

      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'CREATE_SHIPMENT',
          status: 'SUCCESS',
          responsePayload: result.rawResponse as any,
        },
      });

      return result;
    } catch (err) {
      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'CREATE_SHIPMENT',
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      throw err;
    }
  }

  async syncTracking(partnerId: string, orderId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.apiEnabled || !partner.credentials) {
      throw new BadRequestException('API integration not enabled for this partner');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryTracking: { include: { events: { orderBy: { occurredAt: 'desc' }, take: 1 } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.trackingNumber) throw new BadRequestException('Order has no tracking number');

    const credentials = this.decryptCredentials(String(partner.credentials));
    const provider = this.factory.getProvider(partner.code);

    try {
      const result = await provider.trackShipment({
        waybill: order.trackingNumber,
        credentials,
        testMode: partner.testMode,
      });

      let tracking = await this.prisma.deliveryTracking.findUnique({ where: { orderId } });
      if (!tracking) {
        tracking = await this.prisma.deliveryTracking.create({
          data: { orderId, status: result.status },
        });
      }

      const latestEventTime = order.deliveryTracking?.events?.[0]?.occurredAt;

      let addedCount = 0;
      for (const event of result.events) {
        const eventTime = new Date(event.occurredAt);
        if (latestEventTime && eventTime <= new Date(latestEventTime)) continue;

        const existing = await this.prisma.deliveryTrackingEvent.findFirst({
          where: {
            trackingId: tracking.id,
            occurredAt: eventTime,
            status: event.status,
          },
        });
        if (existing) continue;

        await this.prisma.deliveryTrackingEvent.create({
          data: {
            trackingId: tracking.id,
            status: event.status,
            location: event.location,
            notes: event.notes,
            occurredAt: eventTime,
          },
        });
        addedCount++;
      }

      await this.prisma.deliveryTracking.update({
        where: { id: tracking.id },
        data: {
          status: result.status,
          currentLocation: result.currentLocation || undefined,
          estimatedDelivery: result.estimatedDelivery ? new Date(result.estimatedDelivery) : undefined,
        },
      });

      if (result.status === 'DELIVERED') {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });
      } else if (result.status === 'PICKED_UP' && order.status === 'PROCESSING') {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } });
      }

      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'SYNC_TRACKING',
          status: 'SUCCESS',
          responsePayload: { addedEvents: addedCount, newStatus: result.status } as any,
        },
      });

      return { addedEvents: addedCount, tracking: result };
    } catch (err) {
      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'SYNC_TRACKING',
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      throw err;
    }
  }

  async syncAllTracking() {
    const orders = await this.prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        deliveryPartnerId: { not: null },
        status: { in: ['PROCESSING', 'SHIPPED'] },
      },
      select: { id: true, deliveryPartnerId: true },
    });

    let synced = 0;
    let failed = 0;
    const results: any[] = [];

    for (const order of orders) {
      try {
        const result = await this.syncTracking(order.deliveryPartnerId!, order.id);
        synced++;
        results.push({ orderId: order.id, status: 'success', addedEvents: result.addedEvents });
      } catch (err) {
        failed++;
        results.push({ orderId: order.id, status: 'failed', error: err.message });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return { synced, failed, results };
  }

  async checkServiceability(partnerId: string, originPincode: string, destinationPincode: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.apiEnabled || !partner.credentials) {
      throw new BadRequestException('API integration not enabled for this partner');
    }

    const credentials = this.decryptCredentials(String(partner.credentials));
    const provider = this.factory.getProvider(partner.code);
    return provider.getServiceability({
      originPincode,
      destinationPincode,
      credentials,
      testMode: partner.testMode,
    });
  }

  async cancelShipment(partnerId: string, orderId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    if (!partner.apiEnabled || !partner.credentials) {
      throw new BadRequestException('API integration not enabled for this partner');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.trackingNumber) throw new BadRequestException('Order has no tracking number');

    const credentials = this.decryptCredentials(String(partner.credentials));
    const provider = this.factory.getProvider(partner.code);

    try {
      const result = await provider.cancelShipment({
        waybill: order.trackingNumber,
        credentials,
        testMode: partner.testMode,
      });

      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'CANCEL_SHIPMENT',
          status: result.success ? 'SUCCESS' : 'FAILED',
          responsePayload: result.rawResponse as any,
        },
      });

      return result;
    } catch (err) {
      await this.prisma.shipmentSyncLog.create({
        data: {
          orderId,
          partnerId,
          action: 'CANCEL_SHIPMENT',
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      throw err;
    }
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
      throw new BadRequestException('Failed to decrypt delivery partner credentials. Check DELIVERY_PARTNER_CREDENTIALS_KEY.');
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