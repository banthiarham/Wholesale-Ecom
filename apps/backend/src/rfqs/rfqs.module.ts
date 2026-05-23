import { Module } from '@nestjs/common';
import { RfqsController } from './rfqs.controller';
import { QuotesController } from './quotes.controller';
import { RfqsService } from './rfqs.service';
import { QuotesService } from './quotes.service';

@Module({
  controllers: [RfqsController, QuotesController],
  providers: [RfqsService, QuotesService],
  exports: [RfqsService, QuotesService],
})
export class RfqsModule {}
