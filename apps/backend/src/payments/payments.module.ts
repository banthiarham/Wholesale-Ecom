import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CcavenueService } from './ccavenue.service';
import { PaymentGatewaysModule } from '../payment-gateways/payment-gateways.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundsService } from './refunds/refunds.service';
import { RefundsController } from './refunds/refunds.controller';

@Module({
  imports: [PaymentGatewaysModule, NotificationsModule],
  controllers: [PaymentsController, RefundsController],
  providers: [PaymentsService, CcavenueService, RefundsService],
  exports: [PaymentsService, CcavenueService, RefundsService],
})
export class PaymentsModule {}