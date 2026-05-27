import { Injectable } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import {
  DeliveryPartnerProvider,
  ShipmentResult,
  TrackingResult,
  TrackingEventResult,
  ServiceabilityResult,
} from './partner.interface';

@Injectable()
export class CustomPartnerProviderService implements DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean {
    return Object.keys(credentials).length > 0;
  }

  getCredentialFields() {
    return [];
  }

  getApiUrl(testMode: boolean): string {
    return '';
  }

  async createShipment(params): Promise<ShipmentResult> {
    const { credentials, testMode } = params;
    const settings = (credentials as any).__settings || {};
    const endpoint = settings.createShipmentEndpoint;
    const baseUrl = (credentials as any).__apiBaseUrl || '';

    if (!endpoint && !baseUrl) {
      throw new Error('Custom provider: No createShipment endpoint configured. Set settings.apiEndpoints.createShipmentEndpoint and apiBaseUrl on the partner.');
    }

    const url = endpoint?.startsWith('http') ? endpoint : `${baseUrl}${endpoint || '/api/shipment/create'}`;
    const headerKey = settings.headerKey || 'Authorization';
    const headerPrefix = settings.headerPrefix || 'Bearer ';

    const cleanCreds = { ...credentials };
    delete (cleanCreds as any).__settings;
    delete (cleanCreds as any).__apiBaseUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.authType === 'header') {
      headers[headerKey] = headerPrefix + Object.values(cleanCreds)[0];
    } else if (settings.authType === 'basic') {
      const [user, pass] = Object.entries(cleanCreds)[0] || ['', ''];
      headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        receiverAddress: params.receiverAddress,
        packageDetails: params.packageDetails,
      }),
    });

    const data = await res.json();
    const waybillField = settings.waybillField || 'waybill';
    const waybill = data[waybillField] || data.waybill || data.trackingNumber;

    if (!waybill) {
      throw new Error(data.error || data.message || 'Custom provider: No waybill returned');
    }

    return {
      waybill: String(waybill),
      labelUrl: data.labelUrl || data.label_url || undefined,
      rawResponse: data,
    };
  }

  async trackShipment(params): Promise<TrackingResult> {
    const { waybill, credentials, testMode } = params;
    const settings = (credentials as any).__settings || {};
    const endpoint = settings.trackShipmentEndpoint;
    const baseUrl = (credentials as any).__apiBaseUrl || '';

    if (!endpoint && !baseUrl) {
      throw new Error('Custom provider: No trackShipment endpoint configured');
    }

    const url = (endpoint?.startsWith('http') ? endpoint : `${baseUrl}${endpoint || '/api/track'}`)
      .replace('{waybill}', encodeURIComponent(waybill));

    const cleanCreds = { ...credentials };
    delete (cleanCreds as any).__settings;
    delete (cleanCreds as any).__apiBaseUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.authType === 'header') {
      headers[settings.headerKey || 'Authorization'] = `${settings.headerPrefix || 'Bearer '}${Object.values(cleanCreds)[0]}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();

    const statusField = settings.statusField || 'status';
    const eventsField = settings.eventsField || 'events';
    const statusMap: Record<string, DeliveryStatus> = settings.statusMap || {};
    const rawStatus = data[statusField] || data.status || '';

    let mappedStatus: DeliveryStatus = 'PENDING';
    if (statusMap[rawStatus]) {
      mappedStatus = statusMap[rawStatus] as DeliveryStatus;
    }

    const rawEvents = data[eventsField] || data.events || [];
    const events: TrackingEventResult[] = rawEvents.map((e: any) => ({
      status: statusMap[e.status] ? (statusMap[e.status] as DeliveryStatus) : 'PENDING',
      location: e.location || '',
      notes: e.notes || e.description || '',
      occurredAt: e.occurredAt || e.datetime || new Date().toISOString(),
    }));

    return {
      status: mappedStatus,
      currentLocation: data.currentLocation || data.location || '',
      estimatedDelivery: data.estimatedDelivery || data.edd || undefined,
      events,
      rawResponse: data,
    };
  }

  async cancelShipment(params): Promise<{ success: boolean; rawResponse?: any }> {
    const { waybill, credentials } = params;
    const settings = (credentials as any).__settings || {};
    const endpoint = settings.cancelShipmentEndpoint;
    const baseUrl = (credentials as any).__apiBaseUrl || '';

    if (!endpoint && !baseUrl) {
      return { success: false };
    }

    const url = endpoint?.startsWith('http') ? endpoint : `${baseUrl}${endpoint || '/api/cancel'}`;

    const cleanCreds = { ...credentials };
    delete (cleanCreds as any).__settings;
    delete (cleanCreds as any).__apiBaseUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.authType === 'header') {
      headers[settings.headerKey || 'Authorization'] = `${settings.headerPrefix || 'Bearer '}${Object.values(cleanCreds)[0]}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ waybill }),
    });

    const data = await res.json();
    return { success: !!data.success, rawResponse: data };
  }

  async getServiceability(params): Promise<ServiceabilityResult> {
    const { originPincode, destinationPincode, credentials } = params;
    const settings = (credentials as any).__settings || {};
    const endpoint = settings.serviceabilityEndpoint;
    const baseUrl = (credentials as any).__apiBaseUrl || '';

    if (!endpoint && !baseUrl) {
      return { serviceable: false };
    }

    const url = (endpoint?.startsWith('http') ? endpoint : `${baseUrl}${endpoint || '/api/serviceability'}`)
      .replace('{originPincode}', originPincode)
      .replace('{destinationPincode}', destinationPincode);

    const cleanCreds = { ...credentials };
    delete (cleanCreds as any).__settings;
    delete (cleanCreds as any).__apiBaseUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.authType === 'header') {
      headers[settings.headerKey || 'Authorization'] = `${settings.headerPrefix || 'Bearer '}${Object.values(cleanCreds)[0]}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();

    return {
      serviceable: !!data.serviceable || !!data.isServiceable,
      codAvailable: !!data.cod,
      estimatedDeliveryDays: data.deliveryDays || undefined,
      rawResponse: data,
    };
  }
}