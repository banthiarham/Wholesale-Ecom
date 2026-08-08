import { Module } from '@nestjs/common';
import { BulkOrdersController } from './bulk-orders.controller';
import { BulkOrdersService } from './bulk-orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BulkOrdersController],
  providers: [BulkOrdersService],
  exports: [BulkOrdersService],
})
export class BulkOrdersModule {}