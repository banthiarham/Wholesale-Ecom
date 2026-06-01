import { Module } from '@nestjs/common';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';

@Module({
  controllers: [RulesController],
  providers: [RulesService, RulesEngineService],
  exports: [RulesService, RulesEngineService],
})
export class RulesModule {}