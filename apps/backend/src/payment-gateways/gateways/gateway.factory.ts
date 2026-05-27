import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentGatewayProvider } from './gateway.interface';
import { CcavenueGatewayService } from './ccavenue.service';
import { RazorpayGatewayService } from './razorpay.service';
import { StripeGatewayService } from './stripe.service';
import { PayuGatewayService } from './payu.service';
import { CustomGatewayService } from './custom-gateway.service';

const BUILTIN_PROVIDERS = ['CCAVENUE', 'RAZORPAY', 'STRIPE', 'PAYU'];

@Injectable()
export class PaymentGatewayFactory {
  private providers: Map<string, PaymentGatewayProvider> = new Map();

  constructor(
    private ccavenueService: CcavenueGatewayService,
    private razorpayService: RazorpayGatewayService,
    private stripeService: StripeGatewayService,
    private payuService: PayuGatewayService,
    private customGatewayService: CustomGatewayService,
  ) {
    this.providers.set('CCAVENUE', ccavenueService);
    this.providers.set('RAZORPAY', razorpayService);
    this.providers.set('STRIPE', stripeService);
    this.providers.set('PAYU', payuService);
  }

  getProvider(providerName: string): PaymentGatewayProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      // Unknown provider — use the generic custom gateway handler
      return this.customGatewayService;
    }
    return provider;
  }

  isBuiltinProvider(name: string): boolean {
    return BUILTIN_PROVIDERS.includes(name.toUpperCase());
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  getBuiltinProviders(): string[] {
    return [...BUILTIN_PROVIDERS];
  }
}