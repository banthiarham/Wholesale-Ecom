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
  'AWB Assigned': 'PENDING',
  'Pickup Scheduled': 'PENDING',
  'Pickup Complete': 'PICKED_UP',
  'In Transit': 'IN_TRANSIT',
  'At Hub': 'IN_TRANSIT',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  RTO: 'RETURNED',
  Cancelled: 'FAILED',
  Failed: 'FAILED',
};

@Injectable()
export class EcomExpressProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!credentials.apiKey;
  }

  getCredentialFields() {
    return [{ key: 'apiKey', label: 'API Key', required: true }];
  }

  getApiUrl(testMode: boolean): string {
    return testMode ? 'https://staging.ecomexpress.in' : 'https://api.ecomexpress.in';
  }

  private getHeaders(credentials: Record<string, string>) {
    return {
      Authorization: `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createShipment(params): Promise<ShipmentResult> {
    const { orderNumber, receiverAddress, packageDetails, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);
    const addr = receiverAddress || {};

    const body = {
      awb_number: '',
      order_number: orderNumber,
      consignee: {
        name: addr.name || addr.firstName || 'Recipient',
        mobile: addr.phone || '',
        address_line_1: addr.address || addr.line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        pincode: addr.pincode || addr.zip || '',
      },
      product_type: 'Non-Doc',
      weight: packageDetails.weight || 0.5,
      cod_amount: 0,
    };

    const res = await fetch(`${baseUrl}/api/v2/awb/`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const waybill = data.awb_number || data.awb || data.waybill;

    if (!waybill) {
      throw new Error(data.error || data.message || 'Ecom Express: Failed to create shipment');
    }

    return { waybill: String(waybill), rawResponse: data };
  }

  async trackShipment(params): Promise<TrackingResult> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/api/v2/track/awb/${encodeURIComponent(waybill)}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    const shipment = data.shipment || data;
    const activities = shipment.activities || shipment.scan_detail || [];

    const events: TrackingEventResult[] = activities.map((act: any) => ({
      status: this.mapStatus(act.status || act.scan_type || ''),
      location: act.location || act.scan_location || '',
      notes: act.remarks || act.scan_status || '',
      occurredAt: act.datetime || act.scan_datetime || new Date().toISOString(),
    }));

    return {
      status: this.mapStatus(shipment.status || shipment.current_status || ''),
      currentLocation: shipment.current_location || shipment.location || '',
      estimatedDelivery: shipment.edd || shipment.estimated_delivery || undefined,
      events: events.reverse(),
      rawResponse: data,
    };
  }

  async cancelShipment(params): Promise<{ success: boolean; rawResponse?: any }> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(`${baseUrl}/api/v2/cancel/`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify({ awb_number: waybill }),
    });

    const data = await res.json();
    return { success: !!data.success || !!data.cancelled, rawResponse: data };
  }

  async getServiceability(params): Promise<ServiceabilityResult> {
    const { destinationPincode, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/api/v2/pincode/${encodeURIComponent(destinationPincode)}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    return {
      serviceable: !!data.serviceable || !!data.is_serviceable,
      codAvailable: !!data.cod || !!data.is_cod_available,
      estimatedDeliveryDays: data.delivery_days || undefined,
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