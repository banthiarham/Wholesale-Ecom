import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CcavenueService } from './ccavenue.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, CcavenueService],
  exports: [PaymentsService, CcavenueService],
})
export class PaymentsModule {}
