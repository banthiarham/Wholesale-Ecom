import { Module } from '@nestjs/common';
import { PaymentGatewaysController } from './payment-gateways.controller';
import { PaymentGatewaysService } from './payment-gateways.service';
import { PaymentGatewayFactory } from './gateways/gateway.factory';
import { CcavenueGatewayService } from './gateways/ccavenue.service';
import { RazorpayGatewayService } from './gateways/razorpay.service';
import { StripeGatewayService } from './gateways/stripe.service';
import { PayuGatewayService } from './gateways/payu.service';
import { CustomGatewayService } from './gateways/custom-gateway.service';

@Module({
  controllers: [PaymentGatewaysController],
  providers: [
    PaymentGatewaysService,
    PaymentGatewayFactory,
    CcavenueGatewayService,
    RazorpayGatewayService,
    StripeGatewayService,
    PayuGatewayService,
    CustomGatewayService,
  ],
  exports: [PaymentGatewaysService, PaymentGatewayFactory],
})
export class PaymentGatewaysModule {}