import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CsvOrderParserService } from './csv-order-parser.service';
import { ExcelOrderParserService } from './excel-order-parser.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [InventoryModule, PricingModule, NotificationsModule, DeliveryPartnersModule, LoyaltyModule],
  controllers: [OrdersController],
  providers: [OrdersService, CsvOrderParserService, ExcelOrderParserService],
  exports: [OrdersService],
})
export class OrdersModule {}