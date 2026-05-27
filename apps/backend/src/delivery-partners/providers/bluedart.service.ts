import { Injectable } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import {
  DeliveryPartnerProvider,
  ShipmentResult,
  TrackingResult,
  TrackingEventResult,
  ServiceabilityResult,
} from './partner.interface';

const STATUS_MAP: Record<string, DeliveryStatus> = {
  'Shipment Booked': 'PICKED_UP',
  'Shipment In Transit': 'IN_TRANSIT',
  'Shipment Out for Delivery': 'OUT_FOR_DELIVERY',
  'Shipment Delivered': 'DELIVERED',
  'Shipment RTO': 'RETURNED',
  'Shipment Cancelled': 'FAILED',
  'Shipment Collected': 'PICKED_UP',
  Pending: 'PENDING',
};

@Injectable()
export class BlueDartProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.licenseKey && credentials.apiKey);
  }

  getCredentialFields() {
    return [
      { key: 'licenseKey', label: 'License Key', required: true },
      { key: 'apiKey', label: 'API Key', required: true },
      { key: 'profileId', label: 'Profile ID', required: false },
      { key: 'accountNumber', label: 'Account Number', required: false },
    ];
  }

  getApiUrl(testMode: boolean): string {
    return testMode ? 'https://api-test.bluedart.com' : 'https://api.bluedart.com';
  }

  private getHeaders(credentials: Record<string, string>) {
    return {
      JWTToken: credentials.apiKey,
      LicenseKey: credentials.licenseKey,
      'Content-Type': 'application/json',
    };
  }

  async createShipment(params): Promise<ShipmentResult> {
    const { orderNumber, receiverAddress, packageDetails, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);
    const addr = receiverAddress || {};

    const body = {
      requestHeader: {
        licenseKey: credentials.licenseKey,
        profile: { profileId: credentials.profileId || 'SVC1' },
      },
      shipment: {
        consignee: {
          name: addr.name || addr.firstName || 'Recipient',
          contactPhone: addr.phone || '',
          addressLine1: addr.address || addr.line1 || '',
          city: addr.city || '',
          state: addr.state || '',
          pincode: addr.pincode || addr.zip || '',
          country: addr.country || 'India',
        },
        shipmentDetails: {
          productType: 'Non-Doc',
          weight: packageDetails.weight || 0.5,
          referenceNumber: orderNumber,
        },
      },
    };

    const res = await fetch(`${baseUrl}/ShippingAPI/v1/ShipService.svc/json/CreateShipment`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const waybill = data.Shipment?.WaybillNumber || data.WaybillNumber || data.waybill;

    if (!waybill) {
      throw new Error(data.Error?.Message || data.message || 'BlueDart: Failed to create shipment');
    }

    return { waybill: String(waybill), rawResponse: data };
  }

  async trackShipment(params): Promise<TrackingResult> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/TrackingAPI/v1/TrackService.svc/json/GetTrackData?waybill=${encodeURIComponent(waybill)}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    const shipment = data.ShipmentData?.[0]?.Shipment || data.Shipment || data;
    const scans = shipment.Scans || shipment.scanDetail || [];

    const events: TrackingEventResult[] = scans.map((scan: any) => ({
      status: this.mapStatus(scan.ScanDetail?.Status || scan.Status || scan.scan_type || ''),
      location: scan.ScanDetail?.Location || scan.Location || scan.scan_location || '',
      notes: scan.ScanDetail?.Instructions || scan.Instructions || scan.scan_status || '',
      occurredAt: scan.ScanDetail?.ScanDate || scan.ScanDate || scan.scan_datetime || new Date().toISOString(),
    }));

    const currentStatus = shipment.Status || shipment.CurrentStatus;
    return {
      status: this.mapStatus(typeof currentStatus === 'string' ? currentStatus : currentStatus?.Status || ''),
      currentLocation: shipment.Origin || shipment.CurrentLocation || '',
      events: events.reverse(),
      rawResponse: data,
    };
  }

  async cancelShipment(params): Promise<{ success: boolean; rawResponse?: any }> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(`${baseUrl}/ShippingAPI/v1/ShipService.svc/json/CancelShipment`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify({ waybill }),
    });

    const data = await res.json();
    return { success: data.Cancelled || data.Success || false, rawResponse: data };
  }

  async getServiceability(params): Promise<ServiceabilityResult> {
    const { originPincode, destinationPincode, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/ShippingAPI/v1/ShipService.svc/json/GetServiceability?originPincode=${originPincode}&destPincode=${destinationPincode}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    return {
      serviceable: !!data.Serviceable || !!data.IsServiceable,
      estimatedDeliveryDays: data.EDD || data.EstimatedDeliveryDays || undefined,
      codAvailable: !!data.COD || !!data.IsCODAvailable,
      rawResponse: data,
    };
  }

  private mapStatus(status: string): DeliveryStatus {
    const normalized = status.trim();
    for (const [key, value] of Object.entries(STATUS_MAP)) {
      if (normalized.toLowerCase().includes(key.toLowerCase())) {
        return value as DeliveryStatus;
      }
    }
    return 'PENDING';
  }
}