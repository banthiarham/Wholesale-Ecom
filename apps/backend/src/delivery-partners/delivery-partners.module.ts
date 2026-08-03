import { Module } from '@nestjs/common';
import { DeliveryPartnersController } from './delivery-partners.controller';
import { DeliveryPartnersService } from './delivery-partners.service';
import { DeliveryPartnerFactory } from './providers/partner.factory';
import { ShiprocketProviderService } from './providers/shiprocket.service';
import { ShipmozoProviderService } from './providers/shipmozo.service';
import { CustomPartnerProviderService } from './providers/custom-partner.service';

@Module({
  controllers: [DeliveryPartnersController],
  providers: [
    DeliveryPartnersService,
    DeliveryPartnerFactory,
    ShiprocketProviderService,
    ShipmozoProviderService,
    CustomPartnerProviderService,
  ],
  exports: [DeliveryPartnersService, DeliveryPartnerFactory],
})
export class DeliveryPartnersModule {}
