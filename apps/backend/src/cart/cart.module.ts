import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PricingModule } from '../pricing/pricing.module';
import { RulesModule } from '../rules/rules.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PricingModule, RulesModule, SettingsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}