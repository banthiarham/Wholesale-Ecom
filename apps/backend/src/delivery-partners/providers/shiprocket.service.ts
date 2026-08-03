import { Injectable } from '@nestjs/common';
import {
  DeliveryPartnerProvider,
  ShipmentResult,
  TrackingResult,
  ServiceabilityResult,
} from './partner.interface';

/**
 * Shiprocket integration stub.
 *
 * Credential storage, validation and the provider interface are fully wired up so
 * real API calls (auth -> bearer token -> /orders/create/adhoc, /courier/track etc.)
 * can be dropped into the methods below later without touching the DB schema,
 * the DeliveryPartner admin UI, or callers of DeliveryPartnersService.
 *
 * No network calls are made yet - shipment creation/tracking is handled manually
 * via the Shipment Tracking module until real integration is enabled.
 */
@Injectable()
export class ShiprocketProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.email && credentials.password);
  }

  getCredentialFields() {
    return [
      { key: 'email', label: 'Email', required: true },
      { key: 'password', label: 'Password / Token', required: true },
    ];
  }

  getApiUrl(testMode: boolean): string {
    return testMode
      ? 'https://apiv2.shiprocket.in/v1/external'
      : 'https://apiv2.shiprocket.in/v1/external';
  }

  async createShipment(): Promise<ShipmentResult> {
    throw new Error(
      'Shiprocket API integration is not enabled yet. Add the tracking number manually from the Shipment Tracking module.',
    );
  }

  async trackShipment(): Promise<TrackingResult> {
    throw new Error(
      'Shiprocket API integration is not enabled yet. Update delivery status manually from the Shipment Tracking module.',
    );
  }

  async cancelShipment(): Promise<{ success: boolean; rawResponse?: any }> {
    throw new Error('Shiprocket API integration is not enabled yet.');
  }

  async getServiceability(): Promise<ServiceabilityResult> {
    throw new Error('Shiprocket API integration is not enabled yet.');
  }
}
