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
  Manifested: 'PENDING',
  'In Transit': 'IN_TRANSIT',
  Dispatched: 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  RTO: 'RETURNED',
  Cancelled: 'FAILED',
  'Picked Up': 'PICKED_UP',
  'Pickup Scheduled': 'PENDING',
  OD: 'FAILED',
  Pending: 'PENDING',
};

@Injectable()
export class DelhiveryProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return !!credentials.apiKey;
  }

  getCredentialFields() {
    return [{ key: 'apiKey', label: 'API Key / Token', required: true }];
  }

  getApiUrl(testMode: boolean): string {
    return testMode ? 'https://staging-delhivery.com' : 'https://track.delhivery.com';
  }

  private getHeaders(credentials: Record<string, string>) {
    return {
      Authorization: `Token ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createShipment(params): Promise<ShipmentResult> {
    const { orderId, orderNumber, receiverAddress, packageDetails, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);
    const addr = receiverAddress || {};

    const shipments = [
      {
        waybill: '',
        order: orderNumber,
        name: addr.name || addr.firstName || 'Recipient',
        order_date: new Date().toISOString().split('T')[0],
        payment_mode: 'Prepaid',
        product_name: packageDetails.items?.[0]?.title || 'Package',
        product_quantity: packageDetails.items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 1,
        product_price: 0,
        add: addr.address || addr.line1 || '',
        city: addr.city || '',
        state: addr.state || '',
        country: addr.country || 'India',
        phone: addr.phone || '',
        pincode: addr.pincode || addr.zip || '',
        return_add: '',
        return_city: '',
        return_state: '',
        return_country: '',
        return_phone: '',
        return_pincode: '',
        cod_amount: 0,
        weight: packageDetails.weight || 0.5,
        seller_gst_tin: '',
        shipping_mode: 'Surface',
      },
    ];

    const formBody = `format=json&data=${encodeURIComponent(JSON.stringify({ shipments }))}`;

    const res = await fetch(`${baseUrl}/api/cmu/create.json`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${credentials.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const data = await res.json();
    const waybill = data.packages?.[0]?.waybill || data.waybill || data.packages?.[0]?.awb_code;

    if (!waybill) {
      throw new Error(data.error || data.message || 'Delhivery: Failed to create shipment');
    }

    return {
      waybill: String(waybill),
      labelUrl: `${baseUrl}/api/p/packing_slip/?wbns=${waybill}`,
      rawResponse: data,
    };
  }

  async trackShipment(params): Promise<TrackingResult> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    const shipment = data.packages?.[0]?.shipments?.[0];
    if (!shipment) {
      throw new Error('Delhivery: No tracking data found');
    }

    const scans: TrackingEventResult[] = (shipment.scan_detail || []).map((scan: any) => ({
      status: this.mapStatus(scan.scan_type || scan.scan_status || ''),
      location: scan.scan_location || '',
      notes: scan.instructions || scan.scan_status || '',
      occurredAt: scan.scan_datetime || new Date().toISOString(),
    }));

    return {
      status: this.mapStatus(shipment.status?.status || shipment.status || ''),
      currentLocation: shipment.status?.current_location || shipment.scan_detail?.[0]?.scan_location || '',
      estimatedDelivery: shipment.status?.edel_date || undefined,
      events: scans.reverse(),
      rawResponse: data,
    };
  }

  async cancelShipment(params): Promise<{ success: boolean; rawResponse?: any }> {
    const { waybill, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(`${baseUrl}/api/p/edit/`, {
      method: 'POST',
      headers: this.getHeaders(credentials),
      body: JSON.stringify({ waybill, cancellation: true }),
    });

    const data = await res.json();
    return { success: data.status === 'Success' || !!data.waybill, rawResponse: data };
  }

  async getServiceability(params): Promise<ServiceabilityResult> {
    const { originPincode, destinationPincode, credentials, testMode } = params;
    const baseUrl = this.getApiUrl(testMode);

    const res = await fetch(
      `${baseUrl}/api/c/api/pin-codes/json/?pincode=${destinationPincode}&src=${originPincode}`,
      { headers: this.getHeaders(credentials) },
    );

    const data = await res.json();
    const result = data.delivery_codes?.[0];

    return {
      serviceable: !!result?.prepaid || !!result?.cod,
      codAvailable: !!result?.cod,
      estimatedDeliveryDays: result?.del_tt || undefined,
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