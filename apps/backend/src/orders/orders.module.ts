import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CsvOrderParserService } from './csv-order-parser.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';

@Module({
  imports: [InventoryModule, PricingModule, NotificationsModule, DeliveryPartnersModule],
  controllers: [OrdersController],
  providers: [OrdersService, CsvOrderParserService],
  exports: [OrdersService],
})
export class OrdersModule {}
