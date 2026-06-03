import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { SeasonalDiscountsController } from './seasonal-discounts.controller';
import { SeasonalDiscountsService } from './seasonal-discounts.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { ContractPricesController } from './contract-prices.controller';
import { ContractPricesService } from './contract-prices.service';
import { PaymentOffersController } from './payment-offers.controller';
import { PaymentOffersService } from './payment-offers.service';

@Module({
  controllers: [
    PricingController,
    SeasonalDiscountsController,
    CouponsController,
    ContractPricesController,
    PaymentOffersController,
  ],
  providers: [
    PricingService,
    SeasonalDiscountsService,
    CouponsService,
    ContractPricesService,
    PaymentOffersService,
  ],
  exports: [PricingService],
})
export class PricingModule {}
