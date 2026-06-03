import { Module } from '@nestjs/common';
import { BulkOrdersController } from './bulk-orders.controller';
import { BulkOrdersService } from './bulk-orders.service';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PricingModule, OrdersModule],
  controllers: [BulkOrdersController],
  providers: [BulkOrdersService],
  exports: [BulkOrdersService],
})
export class BulkOrdersModule {}