import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsBulkService } from './products-bulk.service';
import { ProductsController } from './products.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsBulkService],
  exports: [ProductsService],
})
export class ProductsModule {}
