import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LoyaltyModule, PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}