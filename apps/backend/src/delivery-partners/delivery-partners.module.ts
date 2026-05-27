import { Module } from '@nestjs/common';
import { DeliveryPartnersController } from './delivery-partners.controller';
import { DeliveryPartnersService } from './delivery-partners.service';
import { DeliveryPartnerFactory } from './providers/partner.factory';
import { DelhiveryProviderService } from './providers/delhivery.service';
import { BlueDartProviderService } from './providers/bluedart.service';
import { EcomExpressProviderService } from './providers/ecom-express.service';
import { DtdcProviderService } from './providers/dtdc.service';
import { CustomPartnerProviderService } from './providers/custom-partner.service';

@Module({
  controllers: [DeliveryPartnersController],
  providers: [
    DeliveryPartnersService,
    DeliveryPartnerFactory,
    DelhiveryProviderService,
    BlueDartProviderService,
    EcomExpressProviderService,
    DtdcProviderService,
    CustomPartnerProviderService,
  ],
  exports: [DeliveryPartnersService, DeliveryPartnerFactory],
})
export class DeliveryPartnersModule {}