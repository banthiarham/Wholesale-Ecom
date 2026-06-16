import { Module } from '@nestjs/common';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';
import { RulesEnforcementService } from './rules-enforcement.service';
import { RulesAuditService } from './rules-audit.service';

@Module({
  controllers: [RulesController],
  providers: [RulesService, RulesEngineService, RulesEnforcementService, RulesAuditService],
  exports: [RulesService, RulesEngineService, RulesEnforcementService, RulesAuditService],
})
export class RulesModule {}