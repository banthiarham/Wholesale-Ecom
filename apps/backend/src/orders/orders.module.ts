import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentReceiptsController } from './payment-receipts.controller';
import { PaymentReceiptsService } from './payment-receipts.service';
import { CsvOrderParserService } from './csv-order-parser.service';
import { ExcelOrderParserService } from './excel-order-parser.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RulesModule } from '../rules/rules.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [InventoryModule, PricingModule, NotificationsModule, DeliveryPartnersModule, LoyaltyModule, RulesModule, SettingsModule],
  controllers: [OrdersController, PaymentReceiptsController],
  providers: [OrdersService, PaymentReceiptsService, CsvOrderParserService, ExcelOrderParserService],
  exports: [OrdersService, PaymentReceiptsService],
})
export class OrdersModule {}