import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { SeasonalDiscountsController } from './seasonal-discounts.controller';
import { SeasonalDiscountsService } from './seasonal-discounts.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { ContractPricesController } from './contract-prices.controller';
import { ContractPricesService } from './contract-prices.service';

@Module({
  controllers: [
    PricingController,
    SeasonalDiscountsController,
    CouponsController,
    ContractPricesController,
  ],
  providers: [
    PricingService,
    SeasonalDiscountsService,
    CouponsService,
    ContractPricesService,
  ],
  exports: [PricingService],
})
export class PricingModule {}
