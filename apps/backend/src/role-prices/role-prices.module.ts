import { Module } from '@nestjs/common';
import { RolePricesController } from './role-prices.controller';
import { RolePricesService } from './role-prices.service';

@Module({
  controllers: [RolePricesController],
  providers: [RolePricesService],
  exports: [RolePricesService],
})
export class RolePricesModule {}