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
  Booked: 'PENDING',
  'In Transit': 'IN_TRANSIT',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  RTO: 'RETURNED',
  Cancelled: 'FAILED',
  'Pick Up': 'PICKED_UP',
  Pending: 'PENDING',
};

@Injectable()
export class DtdcProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!(credentials.apiKey && credentials.customerId);
  }

  getCredentialFields() {
    return [
      { key: 'apiKey', label: 'API Key', required: true },
      { key: 'customerId', label: 'Customer ID', required: true },
    ];
  }

  getApiUrl(testMode: boolean): string {
    return testMode ? 'https://staging-api.dtdc.com' : 'https://api.dtdc.com';
  }

  private getHeaders(credentials: Record<string, string>) {
    return {
      'X-API-Key': credentials.apiKey,
      'X-Customer-ID': credentials.customerId,
      'Content-Type': 'application/json',
    };
  }

  async createShipment(params): Promise<ShipmentResult> {
    const { orderNumber, receiverAddress, packageDetails, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);
    const addr = receiverAddress || {};

    const body = {
      referenceNumber: orderNumber,
      consignee: {
        name: addr.name || addr.firstName || 'Recipient',
        phone: addr.phone || '',
        address: addr.address || addr.line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        pincode: addr.pincode || addr.zip || '',
        country: addr.country || 'India',
      },
      shipmentDetails: {
        productType: 'Non-Doc',
        weight: packageDetails.weight || 0.5,
      },
    };

    const res = await fetch(`${baseUrl}/express/api/shipment/create`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const waybill = data.waybill || data.consignmentNumber || data.trackingNumber;

    if (!waybill) {
      throw new Error(data.error || data.message || 'DTDC: Failed to create shipment');
    }

    return { waybill: String(waybill), rawResponse: data };
  }

  async trackShipment(params): Promise<TrackingResult> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/express/api/track/consignment/${encodeURIComponent(waybill)}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    const tracking = data.tracking || data;
    const activities = tracking.activities || tracking.scanDetail || [];

    const events: TrackingEventResult[] = activities.map((act: any) => ({
      status: this.mapStatus(act.status || act.scan_type || ''),
      location: act.location || act.scan_location || act.office || '',
      notes: act.remarks || act.scan_status || '',
      occurredAt: act.datetime || act.scan_datetime || new Date().toISOString(),
    }));

    return {
      status: this.mapStatus(tracking.status || tracking.currentStatus || ''),
      currentLocation: tracking.currentLocation || tracking.location || '',
      estimatedDelivery: tracking.estimatedDelivery || tracking.edd || undefined,
      events: events.reverse(),
      rawResponse: data,
    };
  }

  async cancelShipment(params): Promise<{ success: boolean; rawResponse?: any }> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(`${baseUrl}/express/api/shipment/cancel`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify({ consignmentNumber: waybill }),
    });

    const data = await res.json();
    return { success: !!data.success || !!data.cancelled, rawResponse: data };
  }

  async getServiceability(params): Promise<ServiceabilityResult> {
    const { originPincode, destinationPincode, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/express/api/pincode/serviceability?originPincode=${originPincode}&destinationPincode=${destinationPincode}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    return {
      serviceable: !!data.serviceable || !!data.isServiceable,
      codAvailable: !!data.cod || !!data.isCodAvailable,
      estimatedDeliveryDays: data.deliveryDays || data.transitDays || undefined,
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