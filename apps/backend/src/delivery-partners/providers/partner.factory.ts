import { Injectable } from '@nestjs/common';
import { DeliveryPartnerProvider } from './partner.interface';
import { ShiprocketProviderService } from './shiprocket.service';
import { ShipmozoProviderService } from './shipmozo.service';
import { CustomPartnerProviderService } from './custom-partner.service';

const BUILTIN_PROVIDERS = ['SHIPROCKET', 'SHIPMOZO'];

@Injectable()
export class DeliveryPartnerFactory {
  private providers: Map<string, DeliveryPartnerProvider> = new Map();

  constructor(
    private shiprocketService: ShiprocketProviderService,
    private shipmozoService: ShipmozoProviderService,
    private customPartnerService: CustomPartnerProviderService,
  ) {
    this.providers.set('SHIPROCKET', shiprocketService);
    this.providers.set('SHIPMOZO', shipmozoService);
  }

  getProvider(code: string): DeliveryPartnerProvider {
    const provider = this.providers.get(code.toUpperCase());
    if (!provider) {
      return this.customPartnerService;
    }
    return provider;
  }

  isBuiltinProvider(code: string): boolean {
    return BUILTIN_PROVIDERS.includes(code.toUpperCase());
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  getBuiltinProviders(): string[] {
    return [...BUILTIN_PROVIDERS];
  }
}
