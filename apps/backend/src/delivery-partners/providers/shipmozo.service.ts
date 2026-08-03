import { Injectable } from '@nestjs/common';
import {
  DeliveryPartnerProvider,
  ShipmentResult,
  TrackingResult,
  ServiceabilityResult,
} from './partner.interface';

/**
 * Shipmozo integration stub.
 *
 * Credential storage, validation and the provider interface are fully wired up so
 * real API calls (public/private key auth -> /order/create, /tracking etc.) can be
 * dropped into the methods below later without touching the DB schema, the
 * DeliveryPartner admin UI, or callers of DeliveryPartnersService.
 *
 * No network calls are made yet - shipment creation/tracking is handled manually
 * via the Shipment Tracking module until real integration is enabled.
 */
@Injectable()
export class ShipmozoProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.apiKey && credentials.apiSecret);
  }

  getCredentialFields() {
    return [
      { key: 'apiKey', label: 'API Key', required: true },
      { key: 'apiSecret', label: 'API Secret', required: true },
    ];
  }

  getApiUrl(testMode: boolean): string {
    return testMode
      ? 'https://shipping-api.shipmozo.com'
      : 'https://shipping-api.shipmozo.com';
  }

  async createShipment(): Promise<ShipmentResult> {
    throw new Error(
      'Shipmozo API integration is not enabled yet. Add the tracking number manually from the Shipment Tracking module.',
    );
  }

  async trackShipment(): Promise<TrackingResult> {
    throw new Error(
      'Shipmozo API integration is not enabled yet. Update delivery status manually from the Shipment Tracking module.',
    );
  }

  async cancelShipment(): Promise<{ success: boolean; rawResponse?: any }> {
    throw new Error('Shipmozo API integration is not enabled yet.');
  }

  async getServiceability(): Promise<ServiceabilityResult> {
    throw new Error('Shipmozo API integration is not enabled yet.');
  }
}
