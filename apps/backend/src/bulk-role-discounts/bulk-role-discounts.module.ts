import { Module } from '@nestjs/common';
import { BulkRoleDiscountsController } from './bulk-role-discounts.controller';
import { BulkRoleDiscountsService } from './bulk-role-discounts.service';

@Module({
  controllers: [BulkRoleDiscountsController],
  providers: [BulkRoleDiscountsService],
  exports: [BulkRoleDiscountsService],
})
export class BulkRoleDiscountsModule {}