import { DeliveryStatus } from '@prisma/client';

export interface ShipmentResult {
  waybill: string;
  labelUrl?: string;
  estimatedDelivery?: string;
  rawResponse?: any;
}

export interface TrackingEventResult {
  status: DeliveryStatus;
  location?: string;
  notes?: string;
  occurredAt: string;
}

export interface TrackingResult {
  status: DeliveryStatus;
  currentLocation?: string;
  estimatedDelivery?: string;
  events: TrackingEventResult[];
  rawResponse?: any;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDeliveryDays?: number;
  codAvailable?: boolean;
  rawResponse?: any;
}

export interface DeliveryPartnerProvider {
  validateCredentials(credentials: Record<string, string>): boolean;
  createShipment(params: {
    orderId: string;
    orderNumber: string;
    senderAddress: any;
    receiverAddress: any;
    packageDetails: { weight?: number; dimensions?: string; items: any[] };
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<ShipmentResult>;
  trackShipment(params: {
    waybill: string;
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<TrackingResult>;
  cancelShipment(params: {
    waybill: string;
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<{ success: boolean; rawResponse?: any }>;
  getServiceability(params: {
    originPincode: string;
    destinationPincode: string;
    credentials: Record<string, string>;
    testMode: boolean;
  }): Promise<ServiceabilityResult>;
  getApiUrl(testMode: boolean): string;
  getCredentialFields(): { key: string; label: string; required: boolean }[];
}