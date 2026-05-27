import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CcavenueService } from './ccavenue.service';
import { PaymentGatewaysModule } from '../payment-gateways/payment-gateways.module';

@Module({
  imports: [PaymentGatewaysModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, CcavenueService],
  exports: [PaymentsService, CcavenueService],
})
export class PaymentsModule {}