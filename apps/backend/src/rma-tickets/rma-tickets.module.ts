import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RmaTicketsController } from './rma-tickets.controller';
import { RmaTicketsService } from './rma-tickets.service';

@Module({
  imports: [PrismaModule],
  controllers: [RmaTicketsController],
  providers: [RmaTicketsService],
  exports: [RmaTicketsService],
})
export class RmaTicketsModule {}
