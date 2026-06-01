import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyEarningService } from './loyalty-earning.service';
import { LoyaltyEarningController } from './loyalty-earning.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LoyaltyController, LoyaltyEarningController],
  providers: [LoyaltyService, LoyaltyEarningService],
  exports: [LoyaltyService, LoyaltyEarningService],
})
export class LoyaltyModule {}