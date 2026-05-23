import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CsvOrderParserService } from './csv-order-parser.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [InventoryModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService, CsvOrderParserService],
  exports: [OrdersService],
})
export class OrdersModule {}
