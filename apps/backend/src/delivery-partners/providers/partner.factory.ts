import { Injectable } from '@nestjs/common';
import { DeliveryPartnerProvider } from './partner.interface';
import { DelhiveryProviderService } from './delhivery.service';
import { BlueDartProviderService } from './bluedart.service';
import { EcomExpressProviderService } from './ecom-express.service';
import { DtdcProviderService } from './dtdc.service';
import { CustomPartnerProviderService } from './custom-partner.service';

const BUILTIN_PROVIDERS = ['DELHIVERY', 'BLUEDART', 'ECOM_EXPRESS', 'DTDC'];

@Injectable()
export class DeliveryPartnerFactory {
  private providers: Map<string, DeliveryPartnerProvider> = new Map();

  constructor(
    private delhiveryService: DelhiveryProviderService,
    private blueDartService: BlueDartProviderService,
    private ecomExpressService: EcomExpressProviderService,
    private dtdcService: DtdcProviderService,
    private customPartnerService: CustomPartnerProviderService,
  ) {
    this.providers.set('DELHIVERY', delhiveryService);
    this.providers.set('BLUEDART', blueDartService);
    this.providers.set('ECOM_EXPRESS', ecomExpressService);
    this.providers.set('DTDC', dtdcService);
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